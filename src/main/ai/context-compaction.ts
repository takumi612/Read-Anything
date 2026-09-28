// src/main/ai/context-compaction.ts
import type { MessageDto } from "@shared/chat";
import { renderHistoryMessage, renderRoleTaggedTranscript } from "@main/ai/prompt";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { conversations } from "@main/db/schema";
import { listMessagesAfterSeq } from "@main/chat/messages";
import { estimateTokens } from "@shared/tokens";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { RunBackground } from "@main/ai/background-limiter";
import { createLogger } from "@main/logger";

const log = createLogger("summary");

/** Chỉ nén khi số token ước tính của các lượt gần đây vượt ngưỡng này. */
export const TAIL_TOKENS_HIGH = 100_000;
/** Mục tiêu sau nén: số token ước tính còn dưới hoặc bằng ngưỡng này. */
export const TAIL_TOKENS_LOW = 10_000;
/** Số tin nhắn gần nhất tối thiểu phải giữ nguyên văn. */
export const MIN_RECENT_TURNS = 20;
/** Giới hạn token đầu ra khi cập nhật bản tóm tắt cuốn chiếu. */
export const SUMMARY_MAX_TOKENS = 4096;
/** Giới hạn ký tự của hội thoại gửi cho model; nếu quá dài thì bỏ phần cũ. */
export const COMPACTION_INPUT_MAX_CHARS = 180_000;

export interface FoldPlan {
  /** Seq cuối cùng đã được nén vào bản tóm tắt. */
  foldThroughSeq: number;
  /** Các lượt được nén, theo thứ tự tăng dần. */
  foldedTurns: MessageDto[];
}

export interface FoldBudget {
  high: number;
  low: number;
  minRecent: number;
}

/**
 * Chọn phần đầu hội thoại cần nén từ các lượt đã sắp theo seq.
 * Chỉ nén khi vượt high; giữ tối đa các lượt mới sao cho phần còn lại không quá low,
 * nhưng luôn giữ ít nhất minRecent tin nhắn. Ranh giới nén nằm sau lượt trợ lý để
 * giữ nguyên cặp hỏi đáp; trả null nếu không có phần nào nén được.
 */
export function planFold(
  tail: MessageDto[],
  tokensOf: (m: MessageDto) => number,
  budget: FoldBudget,
): FoldPlan | null {
  const total = tail.reduce((s, m) => s + tokensOf(m), 0);
  if (total <= budget.high) return null;

  // Tính từ mới về cũ; giữ ít nhất minRecent và dừng trước khi vượt ngưỡng low.
  let keep = 0;
  let acc = 0;
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = tokensOf(tail[i]!);
    if (keep >= budget.minRecent && acc + t > budget.low) break;
    acc += t;
    keep++;
  }

  // Phần giữ lại phải bắt đầu bằng lượt người dùng; thêm lượt trước đó nếu cần.
  let keepStart = tail.length - keep;
  if (keepStart > 0 && keepStart < tail.length && tail[keepStart]!.role === "assistant")
    keepStart--;

  const foldCount = keepStart;
  if (foldCount <= 0) return null;
  return { foldThroughSeq: tail[foldCount - 1]!.seq, foldedTurns: tail.slice(0, foldCount) };
}

/** Chuyển các lượt bị nén thành văn bản có nhãn vai trò; nếu dài thì giữ phần mới hơn. */
export function renderFoldedTranscript(
  folded: MessageDto[],
  maxChars = COMPACTION_INPUT_MAX_CHARS,
): string {
  const transcript = renderRoleTaggedTranscript(folded);
  return transcript.length > maxChars ? transcript.slice(transcript.length - maxChars) : transcript;
}

export interface CompactionDeps {
  db: DB;
  /** Hàm chọn model tóm tắt, dùng chung với các tác vụ AI nền khác. */
  resolveModel: () => ResolvedModel;
  /** Giới hạn tác vụ nền chạy đồng thời, dùng chung với tóm tắt và đặt tên. */
  runBackground: RunBackground;
}

const COMPACTION_SYSTEM =
  "You maintain a running summary of an ongoing conversation between a user and a reading " +
  "assistant about a book. Given the previous summary and new exchanges, produce an updated, " +
  "concise summary that preserves: what the user is reading, the user's stated opinions, " +
  "preferences and decisions, and any facts the assistant should remember. Drop pleasantries " +
  "and redundancy. Output only the summary, no preamble.";

// Trạng thái nén tạm trong bộ nhớ để tránh chạy trùng; khởi động lại sẽ xóa.
const compactingConversations = new Set<string>();

/** Chỉ dùng trong kiểm thử: xóa trạng thái nén đang chạy. */
export function __resetCompactionRuntime(): void {
  compactingConversations.clear();
}

/**
 * Sau mỗi lượt, nếu các tin nhắn có seq > S vượt ngân sách, nén những cặp hỏi đáp cũ
 * vào bản tóm tắt cuốn chiếu rồi tăng summarizedThroughSeq.
 * Nếu lỗi, chưa có model hoặc hội thoại bị xóa, ghi cảnh báo và thử lại sau; không chặn gửi chat.
 * Kiểm thử có thể truyền ngưỡng nhỏ để buộc tác vụ chạy.
 */
export async function maybeCompactConversation(
  deps: CompactionDeps,
  conversationId: string,
  budget: FoldBudget = {
    high: TAIL_TOKENS_HIGH,
    low: TAIL_TOKENS_LOW,
    minRecent: MIN_RECENT_TURNS,
  },
): Promise<void> {
  const { db, resolveModel } = deps;
  if (compactingConversations.has(conversationId)) return; // Tránh nén trùng.
  const resolved = resolveModel();
  if (!resolved.ok) {
    log.warn("summary model not configured; skip compaction", resolved.reason);
    return;
  }
  compactingConversations.add(conversationId);
  try {
    const convo = db
      .select({
        summary: conversations.contextSummary,
        through: conversations.summarizedThroughSeq,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (!convo) return; // Hội thoại đã bị xóa.

    const tail = listMessagesAfterSeq(db, conversationId, convo.through);
    const plan = planFold(tail, (m) => estimateTokens(renderHistoryMessage(m)), budget);
    if (!plan) return; // Chưa vượt ngưỡng hoặc không có phần cần nén.

    const prior = convo.summary?.trim() ? `Previous summary:\n${convo.summary.trim()}\n\n` : "";
    const transcript = renderFoldedTranscript(plan.foldedTurns);
    const { text } = await deps.runBackground(() =>
      generateText({
        model: resolved.model,
        reasoning: resolved.reasoningEffort, // undefined dùng mặc định của provider.
        instructions: COMPACTION_SYSTEM,
        prompt: `${prior}New exchanges:\n${transcript}`,
        maxOutputTokens: SUMMARY_MAX_TOKENS,
        maxRetries: 1,
      }),
    );
    if (!text.trim()) {
      log.warn(`conversation ${conversationId} compaction produced empty summary; skip`);
      return;
    }

    // Kiểm tra hội thoại còn tồn tại trước khi ghi; nếu đã bị xóa thì bỏ kết quả.
    const still = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (!still) {
      log.debug("conversation deleted mid-compaction; drop", conversationId);
      return;
    }
    db.update(conversations)
      .set({ contextSummary: text.trim(), summarizedThroughSeq: plan.foldThroughSeq })
      .where(eq(conversations.id, conversationId))
      .run();
  } catch (err) {
    log.warn(`conversation ${conversationId} compaction failed`, err);
  } finally {
    compactingConversations.delete(conversationId);
  }
}
