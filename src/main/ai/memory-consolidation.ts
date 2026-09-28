// Bộ sắp xếp bộ nhớ chạy nền (spec 2026-06-16).
// Gọi generateText một lần, tự phân tích JSON bằng parseMemoryOps, rồi ghi DB theo quy tắc xác định.
// Không dùng generateObject/response_format vì mức hỗ trợ json_object và tool khác nhau giữa các provider.
// Tự phân tích văn bản để dùng được với mọi model và kiểm thử độc lập.
import { z } from "zod";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import {
  createMemory,
  deleteMemoryById,
  getMemoryBySlug,
  listMemories,
  updateMemoryById,
} from "@main/memory/repository";
import { memorySlug } from "@shared/memory";
import { renderRoleTaggedTranscript } from "@main/ai/prompt";
import { parseJsonOutput } from "@main/ai/structured-output";
import { conversations } from "@main/db/schema";
import { listMessagesAfterSeq } from "@main/chat/messages";
import { getPreference } from "@main/preferences/repository";
import type { DB } from "@main/db/client";
import type { MessageDto } from "@shared/chat";
import type { MemoryDto } from "@shared/memory";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { RunBackground } from "@main/ai/background-limiter";
import type { AppNotification } from "@shared/chat";
import { createLogger } from "@main/logger";

const log = createLogger("memory");

/** Sắp xếp bộ nhớ nền sau mỗi N lượt của trợ lý. */
export const MEMORY_PASS_EVERY_N_TURNS = 5;
/** Số ký tự tối đa gửi cho model; nếu vượt thì bỏ phần đầu, giữ nội dung mới hơn. */
export const MEMORY_PASS_INPUT_MAX_CHARS = 180_000;
/** Số token đầu ra tối đa cho mỗi lần sắp xếp. */
export const MEMORY_PASS_MAX_TOKENS = 8192;

/** Danh sách thao tác cần áp dụng; model chỉ tạo danh sách này, code sẽ thực thi theo quy tắc xác định. */
const memoryOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    slug: memorySlug,
    title: z.string().min(1),
    description: z.string().min(1),
    body: z.string().min(1),
    reason: z.string(),
  }),
  z.object({
    op: z.literal("update"),
    slug: memorySlug,
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    reason: z.string(),
  }),
  z.object({ op: z.literal("delete"), slug: memorySlug, reason: z.string() }),
]);
export const memoryPassOutput = z.object({ ops: z.array(memoryOp) });
export type MemoryOp = z.infer<typeof memoryOp>;

export interface ApplyResult {
  saved: number;
  updated: number;
  deleted: number;
}

/** Ghi từng thao tác vào DB qua repository CRUD, đồng bộ cả bảng liên kết [[slug]]; lỗi từng mục được tách riêng. */
export function applyMemoryOps(db: DB, ops: MemoryOp[]): ApplyResult {
  const result: ApplyResult = { saved: 0, updated: 0, deleted: 0 };
  for (const op of ops) {
    try {
      if (op.op === "save") {
        if (getMemoryBySlug(db, op.slug)) {
          log.warn(`consolidate: save slug exists, skip: ${op.slug}`);
          continue;
        }
        createMemory(db, {
          slug: op.slug,
          title: op.title,
          description: op.description,
          body: op.body,
        });
        result.saved++;
      } else if (op.op === "update") {
        const existing = getMemoryBySlug(db, op.slug);
        if (!existing) {
          log.warn(`consolidate: update slug missing, skip: ${op.slug}`);
          continue;
        }
        updateMemoryById(db, {
          id: existing.id,
          title: op.title,
          description: op.description,
          body: op.body,
        });
        result.updated++;
      } else {
        const existing = getMemoryBySlug(db, op.slug);
        if (!existing) {
          log.warn(`consolidate: delete slug missing, skip: ${op.slug}`);
          continue;
        }
        deleteMemoryById(db, existing.id);
        result.deleted++;
      }
    } catch (err) {
      log.warn(`consolidate: op failed (${op.op} ${op.slug})`, err);
    }
  }
  return result;
}

/** Dựng đầu vào từ toàn bộ bộ nhớ hiện có và các lượt hội thoại gần đây.
 * Phân vai bằng thẻ <user>/<assistant>; dùng chung renderRoleTaggedTranscript với bộ nén ngữ cảnh.
 * Nếu quá dài, bỏ phần đầu để giữ lại nội dung mới hơn. */
export function renderMemoryPassInput(
  turns: MessageDto[],
  memories: MemoryDto[],
  maxChars = MEMORY_PASS_INPUT_MAX_CHARS,
): string {
  const memoryBlock =
    memories.length === 0
      ? "(no existing memories)"
      : memories
          .map(
            (m) => `- [${m.slug}] ${m.title} — ${m.description}\n  ${m.body.replace(/\n/g, " ")}`,
          )
          .join("\n");
  const transcript = renderRoleTaggedTranscript(turns);
  const combined = `## Existing memories\n\n${memoryBlock}\n\n## Recent conversation (oldest first)\n\n${transcript}`;
  return combined.length > maxChars ? combined.slice(combined.length - maxChars) : combined;
}

/**
 * Trích và kiểm tra danh sách thao tác từ văn bản model, không phụ thuộc provider hay response_format:
 * bỏ code fence → tìm đối tượng JSON ngoài cùng theo cặp ngoặc → JSON.parse → kiểm tra bằng Zod.
 * Nếu có lỗi, trả null để bên gọi bỏ qua lượt này và thử lại sau.
 */
export function parseMemoryOps(text: string): z.infer<typeof memoryPassOutput> | null {
  return parseJsonOutput(text, memoryPassOutput);
}

// Prompt nêu rõ định dạng và ví dụ để model tạo JSON mà parseMemoryOps đọc được.
export const CONSOLIDATION_SYSTEM =
  "You are the memory librarian for a reading assistant named Lia. You are given Lia's existing " +
  "long-term memories about the reader and the most recent exchanges of one conversation. Keep the " +
  "memory store accurate and tidy by emitting a list of operations.\n\n" +
  "The conversation is given as <user> and <assistant> turns. Attribute facts carefully: only text " +
  "the reader wrote inside <user> reflects the reader. Inside a <user> turn, sections like " +
  '"## Đoạn đã chọn" / "## Tóm tắt toàn bộ sách" / "## Tóm tắt chương" / "## Ngữ cảnh xung quanh" are book material the reader was ' +
  "viewing — quoted content, NOT the reader's own words or opinions. Text inside <assistant> is Lia " +
  "speaking, not the reader. Never attribute a book passage's claims to the reader.\n\n" +
  'Save (op "save") a NEW memory only for durable facts worth remembering across conversations: the ' +
  "reader's lasting preferences, distinctive viewpoints, recurring concepts, thinking frameworks, or " +
  "corrections to Lia's behavior. Do NOT save book content (summaries cover that) or one-off, " +
  'transactional questions. Reuse an existing topic with "update" instead of creating near-duplicates.\n\n' +
  'Update (op "update") to merge near-duplicates into one canonical memory, refine unclear wording, or ' +
  "enrich an existing memory. Body is replaced wholesale when provided.\n\n" +
  'Delete (op "delete") ONLY a redundant duplicate whose content you have merged into another memory in ' +
  "the same batch. NEVER delete a memory just because it looks old or stale — only the reader can judge that.\n\n" +
  "Write memory content in the reader's language; slugs are always English kebab-case. Link related " +
  "memories inside body text with [[slug]]. Be conservative: if nothing is clearly worth changing, return " +
  "an empty ops array. Give a one-sentence reason for each operation.\n\n" +
  "Output ONLY a JSON object — no markdown fences, no prose before or after. Shape:\n" +
  '{"ops": [\n' +
  '  {"op": "save", "slug": "kebab-case-slug", "title": "...", "description": "...", "body": "...", "reason": "..."},\n' +
  '  {"op": "update", "slug": "existing-slug", "title": "...", "description": "...", "body": "...", "reason": "..."},\n' +
  '  {"op": "delete", "slug": "redundant-slug", "reason": "..."}\n' +
  "]}\n" +
  'For "update", include only the fields you are changing. If nothing should change, output {"ops": []}.';

export interface ConsolidationDeps {
  db: DB;
  /** Hàm chọn model tóm tắt, dùng chung với nén ngữ cảnh, đặt tên và tóm tắt. */
  resolveModel: () => ResolvedModel;
  /** Giới hạn tác vụ nền chạy đồng thời, dùng chung mức tối đa với các tác vụ AI khác. */
  runBackground: RunBackground;
  /** Kênh báo từ main sang renderer; bản thật dùng notifyRenderer, kiểm thử dùng spy. */
  notify: (n: AppNotification) => void;
}

// Trạng thái chạy tạm trong bộ nhớ để tránh xử lý trùng; khởi động lại sẽ xóa.
const consolidatingConversations = new Set<string>();

/** Chỉ dùng trong kiểm thử: xóa trạng thái sắp xếp bộ nhớ đang chạy. */
export function __resetConsolidationRuntime(): void {
  consolidatingConversations.clear();
}

/**
 * Sau mỗi everyN lượt trợ lý, chạy nền để đọc các lượt mới kể từ memoryThroughSeq và bộ nhớ hiện có.
 * Model tạo danh sách thao tác; code áp dụng vào DB rồi tăng memoryThroughSeq và chỉ báo khi có thay đổi.
 * Nếu lỗi, chưa có model hoặc hội thoại đã bị xóa: ghi cảnh báo, giữ nguyên trạng thái và thử ở lượt sau.
 * Chỉ chạy khi memoryEnabled và memoryAutoConsolidate đều bật.
 */
export async function maybeConsolidateMemory(
  deps: ConsolidationDeps,
  conversationId: string,
  everyN = MEMORY_PASS_EVERY_N_TURNS,
): Promise<void> {
  const { db, resolveModel, runBackground, notify } = deps;

  // Cần bật cả hai tùy chọn bộ nhớ.
  const memoryEnabled = getPreference(db, "memoryEnabled") ?? true;
  if (!memoryEnabled) return;
  const auto = getPreference(db, "memoryAutoConsolidate") ?? false;
  if (!auto) return;

  if (consolidatingConversations.has(conversationId)) return; // Tránh chạy trùng.

  const convo = db
    .select({ through: conversations.memoryThroughSeq })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();
  if (!convo) return; // Hội thoại đã bị xóa.

  const through = convo.through ?? null;
  const tail = listMessagesAfterSeq(db, conversationId, through);
  const assistantTurns = tail.filter((m) => m.role === "assistant").length;
  if (assistantTurns < everyN) {
    log.debug(`consolidation pending conv=${conversationId} turns=${assistantTurns}/${everyN}`);
    return; // Chưa đủ số lượt.
  }

  const resolved = resolveModel();
  if (!resolved.ok) {
    log.warn("summary model not configured; skip consolidation", resolved.reason);
    return;
  }

  consolidatingConversations.add(conversationId);
  try {
    const memories = listMemories(db);
    const input = renderMemoryPassInput(tail, memories);
    log.debug(
      `consolidation start conv=${conversationId} turns=${assistantTurns} memories=${memories.length} inputChars=${input.length}`,
    );
    const { text } = await runBackground(() =>
      generateText({
        model: resolved.model,
        reasoning: resolved.reasoningEffort, // v7 dùng reasoning cấp cao nhất; undefined = mặc định của nhà cung cấp
        instructions: CONSOLIDATION_SYSTEM,
        prompt: input,
        maxOutputTokens: MEMORY_PASS_MAX_TOKENS,
        maxRetries: 1,
      }),
    );
    const parsed = parseMemoryOps(text);
    if (!parsed) {
      log.warn(
        `conversation ${conversationId} consolidation: unparseable model output; skip (retry next turn)`,
      );
      return; // Giữ nguyên mốc xử lý để thử ở lượt sau.
    }

    // Kiểm tra hội thoại còn tồn tại trước khi ghi; nếu đã bị xóa thì bỏ kết quả.
    const still = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (!still) {
      log.debug("conversation deleted mid-consolidation; drop", conversationId);
      return;
    }

    const applied = applyMemoryOps(db, parsed.ops);
    const latestSeq = tail.at(-1)?.seq ?? through ?? 0;
    db.update(conversations)
      .set({ memoryThroughSeq: latestSeq })
      .where(eq(conversations.id, conversationId))
      .run();

    const total = applied.saved + applied.updated + applied.deleted;
    if (total > 0) {
      notify({
        kind: "memoryConsolidated",
        saved: applied.saved,
        updated: applied.updated,
        deleted: applied.deleted,
      });
      log.info(
        `consolidated memories conv=${conversationId} saved=${applied.saved} updated=${applied.updated} deleted=${applied.deleted}`,
      );
    } else {
      log.debug(`consolidation produced no changes conv=${conversationId} (empty ops)`);
    }
  } catch (err) {
    log.warn(`conversation ${conversationId} consolidation failed`, err);
  } finally {
    consolidatingConversations.delete(conversationId);
  }
}
