// src/main/chat/conversation-title.ts
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { conversations } from "@main/db/schema";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { RunBackground } from "@main/ai/background-limiter";
import { createLogger } from "@main/logger";

const log = createLogger("chat");

const MAX_TITLE_LEN = 40;

// Ghi rõ các mã Unicode để trình định dạng không làm mất ký tự:
//   U+0022 " dấu ngoặc kép ASCII   U+0027 ' dấu nháy đơn ASCII
//   U+201C “ ngoặc kép mở         U+201D ” ngoặc kép đóng
//   U+2018 ‘ nháy đơn mở         U+2019 ’ nháy đơn đóng
//   U+300C 「 ngoặc mở kiểu Nhật   U+300D 」 ngoặc đóng kiểu Nhật
//   U+300E 『 ngoặc kép mở kiểu Nhật U+300F 』 ngoặc kép đóng kiểu Nhật
const QUOTE_EDGES = /^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g;

const NAMING_SYSTEM =
  "Bạn là trợ lý đặt tên cuộc trò chuyện. Dựa trên một lượt hội thoại, hãy đặt tiêu đề ngắn gọn thể hiện chủ đề. " +
  "Dùng cùng ngôn ngữ với cuộc hội thoại; tối đa 15 ký tự hoặc 8 từ; chỉ trả về tiêu đề, không thêm dấu ngoặc, dấu chấm hay lời giải thích.";

export interface NamingDeps {
  db: DB;
  resolveModel: () => ResolvedModel;
  /** Giới hạn tác vụ nền chạy đồng thời; dùng chung mức tối đa với tóm tắt và nén ngữ cảnh. */
  runBackground: RunBackground;
}

// Trạng thái đặt tên chỉ tồn tại trong bộ nhớ tiến trình (spec §5).
// Xóa khi tác vụ kết thúc, không lưu DB; khởi động lại sẽ xóa trạng thái này.
// Tiêu đề null do tác vụ lỗi không bị hiểu nhầm là đang được đặt tên.
const namingInFlight = new Set<string>();

export function isNamingConversation(id: string): boolean {
  return namingInFlight.has(id);
}

/** Chỉ dùng trong kiểm thử: xóa trạng thái đặt tên đang chạy. */
export function __resetNamingRuntime(): void {
  namingInFlight.clear();
}

/** Chuẩn hóa tiêu đề: lấy dòng đầu tiên có chữ, bỏ ngoặc hai đầu, gộp khoảng trắng và cắt ở MAX_TITLE_LEN. */
export function sanitizeTitle(raw: string): string {
  const firstLine =
    raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const unquoted = firstLine.replace(QUOTE_EDGES, "");
  const collapsed = unquoted.replace(/\s+/g, " ").trim();
  return [...collapsed].length <= MAX_TITLE_LEN // oxlint-disable-line no-misused-spread
    ? collapsed
    : [...collapsed].slice(0, MAX_TITLE_LEN).join("") + "…"; // oxlint-disable-line no-misused-spread
}

/**
 * Tự đặt tên sau lượt hội thoại đầu tiên (spec §5) bằng một yêu cầu AI ngắn, không truyền trực tuyến.
 * Tác vụ nền: nếu lỗi hoặc chưa cấu hình model, giữ title là null để UI hiển thị chuỗi dự phòng.
 */
export async function nameConversation(
  deps: NamingDeps,
  conversationId: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  if (namingInFlight.has(conversationId)) return;
  const resolved = deps.resolveModel();
  if (!resolved.ok) {
    log.warn("model not configured; keep title null", resolved.reason);
    return;
  }
  namingInFlight.add(conversationId);
  try {
    const { text } = await deps.runBackground(() =>
      generateText({
        model: resolved.model,
        reasoning: resolved.reasoningEffort, // v7 dùng reasoning cấp cao nhất; undefined = mặc định của nhà cung cấp
        instructions: NAMING_SYSTEM,
        prompt: `Người dùng: ${userText}\n\nTrợ lý: ${assistantText}`,
      }),
    );
    const title = sanitizeTitle(text);
    if (!title) return;
    // Chỉ ghi khi title vẫn null để không ghi đè tiêu đề vừa được đặt ở nơi khác.
    const row = deps.db
      .select({ title: conversations.title })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (row && row.title == null) {
      deps.db
        .update(conversations)
        .set({ title })
        .where(eq(conversations.id, conversationId))
        .run();
    }
  } catch (err) {
    log.warn("failed; keep title null", err);
  } finally {
    namingInFlight.delete(conversationId);
  }
}
