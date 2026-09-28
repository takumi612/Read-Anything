// src/shared/chat.ts
import { z } from "zod";
import type { UIMessage, UIMessageChunk } from "ai";
import { chipIdSchema } from "@shared/types";
import type { MessageMetadata, MessageRole, MessageStatus } from "@shared/types";

/** Chip ngữ cảnh cho renderer; snapshot lưu DB chỉ giữ id, content và tokenCount. */
export const chipSchema = z.object({
  id: chipIdSchema,
  labelKey: z.string(),
  content: z.string(),
  tokenCount: z.number().int().nonnegative(),
  /**
   * Ba trạng thái: required là chip cũ đã gửi và không thể chỉnh;
   * on/off là chip hiện tại có thể bật tắt. Renderer bỏ chip off trước khi gửi.
   */
  state: z.enum(["required", "on", "off"]),
});
export type Chip = z.infer<typeof chipSchema>;

/** Đầu vào ai:build-chips: đoạn chọn và ba đoạn văn liền kề do renderer trích xuất. */
export const buildChipsInput = z.object({
  selection: z.string().min(1),
  paragraphBefore: z.string().nullish(),
  paragraphCurrent: z.string(),
  paragraphAfter: z.string().nullish(),
});
export type BuildChipsInput = z.infer<typeof buildChipsInput>;

/** Inline translation sends only the selection and its local paragraph to the configured provider. */
export const translateSelectionInput = z.object({
  selection: z.string().trim().min(1).max(4000),
  context: z.string().trim().max(1200),
});

export interface TranslateSelectionResult {
  translation: string;
}

export const readingContextSchema = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("pdf"),
    page: z.number().int().min(1),
    pageCount: z.number().int().min(1).nullable().optional(),
    chapterId: z.string().min(1).nullable().optional(),
    chapterTitle: z.string().min(1).nullable().optional(),
  }),
  z.object({
    format: z.literal("epub"),
    chapterId: z.string().min(1),
    chapterTitle: z.string().min(1).nullable().optional(),
    offset: z.number().int().nonnegative().optional(),
    maxChars: z.number().int().positive().optional(),
    spineIndex: z.number().int().nonnegative().optional(),
    locator: z.string().min(1).nullable().optional(),
  }),
]);
export type ReadingContext = z.infer<typeof readingContextSchema>;

/** Đầu vào tạo hội thoại; bookId null hoặc thiếu là hội thoại ở thư viện (spec §4.1). */
export const createConversationInput = z.object({
  bookId: z.string().min(1).nullable().optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationInput>;

/** Đầu vào liệt kê hội thoại; bookId null liệt kê hội thoại ở thư viện. */
export const listConversationsInput = z.object({
  bookId: z.string().min(1).nullable(),
});
export type ListConversationsInput = z.infer<typeof listConversationsInput>;

/** Đầu vào lấy một hội thoại. */
export const conversationIdInput = z.object({ id: z.string().min(1) });
export type ConversationIdInput = z.infer<typeof conversationIdInput>;

/** Đầu vào lấy tin nhắn của hội thoại. */
export const messagesByConversationInput = z.object({
  conversationId: z.string().min(1),
  beforeSeq: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
export type MessagesByConversationInput = z.infer<typeof messagesByConversationInput>;

/** Kết quả lấy tin nhắn của hội thoại. */
export interface MessagesByConversationOutput {
  messages: MessageDto[];
  hasMore: boolean;
}

/** Dữ liệu hội thoại cho UI; bookId null là hội thoại thư viện; isNaming lấy từ trạng thái tạm ở main. */
export interface ConversationDto {
  id: string;
  bookId: string | null;
  title: string | null;
  /** Đang tự đặt tên hội thoại. */
  isNaming: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: MessageRole;
  parts: UIMessage["parts"];
  metadata: MessageMetadata | null;
  status: MessageStatus;
  seq: number;
  createdAt: number;
}

/** Đầu vào nghiệp vụ của runSend, chưa có streamId; conversationId phải được tạo trước. */
export const sendInputSchema = z.object({
  bookId: z.string().min(1).nullable(), // null là ngữ cảnh thư viện.
  conversationId: z.string().min(1),
  chips: z.array(chipSchema),
  userText: z.string().min(1),
  readingContext: readingContextSchema.nullish(),
  webSearch: z.boolean().optional(),
});
export type SendInput = z.infer<typeof sendInputSchema>;

/** Dữ liệu IPC ai:send: đầu vào nghiệp vụ và streamId do renderer tạo. */
export const sendRequest = sendInputSchema.extend({ streamId: z.string().min(1) });
export type SendRequest = z.infer<typeof sendRequest>;

/** Phản hồi xác nhận của ai:send; nội dung tăng dần đi qua sự kiện ai:chunk. */
export const sendAck = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), conversationId: z.string() }),
  z.object({ ok: z.literal(false), reason: z.string() }),
]);
export type SendAck = z.infer<typeof sendAck>;

/** Đầu vào ai:abort. */
export const abortInput = z.object({ streamId: z.string().min(1) });
export type AbortInput = z.infer<typeof abortInput>;

/** Sự kiện ai:chunk từ main sang renderer; UIMessageChunk do AI SDK định nghĩa. */
export type AiStreamEvent =
  | { streamId: string; type: "chunk"; chunk: UIMessageChunk }
  | { streamId: string; type: "finish" }
  | { streamId: string; type: "error"; message: string };

/** Thông báo từ main sang renderer; renderer chuyển từng kind thành toast theo ngôn ngữ. */
export type AppNotification = {
  kind: "memoryConsolidated";
  saved: number;
  updated: number;
  deleted: number;
};

/** Đầu vào nghiệp vụ của ai:resend, chưa có streamId. */
export const resendInputSchema = z.object({
  conversationId: z.string().min(1),
  userMessageId: z.string().min(1),
  userText: z.string().min(1),
  webSearch: z.boolean().optional(),
});
export type ResendInput = z.infer<typeof resendInputSchema>;
/** Dữ liệu IPC ai:resend: đầu vào nghiệp vụ và streamId. */
export const resendRequest = resendInputSchema.extend({ streamId: z.string().min(1) });
export type ResendRequest = z.infer<typeof resendRequest>;
