// src/main/chat/messages.ts
import { and, asc, desc, eq, gt, lt, max } from "drizzle-orm";
import type { UIMessage } from "ai";
import type { DB } from "@main/db/client";
import { conversations, messages } from "@main/db/schema";
import type { MessageDto } from "@shared/chat";
import { createLogger } from "@main/logger";

const log = createLogger("chat");
import {
  messageMetadataSchema,
  type MessageMetadata,
  type MessageRole,
  type MessageStatus,
} from "@shared/types";

type MessageRow = typeof messages.$inferSelect;

/** Kiểm tra metadata JSON khi đọc DB; dữ liệu cũ/sai schema được ghi nhận và trả null. */
function parseMetadata(raw: MessageRow["metadata"]): MessageMetadata | null {
  if (raw == null) return null;
  const parsed = messageMetadataSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  log.warn("invalid metadata json; degrading to null", parsed.error.message);
  return null;
}

function toDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    parts: row.parts,
    metadata: parseMetadata(row.metadata),
    status: row.status,
    seq: row.seq,
    createdAt: row.createdAt,
  };
}

export interface AppendMessageInput {
  conversationId: string;
  role: MessageRole;
  parts: UIMessage["parts"];
  metadata?: MessageMetadata | null;
  /** Trạng thái cuối; mặc định complete, các dòng user/system luôn complete. */
  status?: MessageStatus;
}

/** Thêm tin nhắn trong transaction: lấy seq kế tiếp, chèn dòng và cập nhật thời gian hội thoại. */
export function appendMessage(db: DB, input: AppendMessageInput): MessageDto {
  return db.transaction((tx) => {
    const top = tx
      .select({ m: max(messages.seq) })
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId))
      .get();
    // Hội thoại rỗng bắt đầu ở seq=0.
    const nextSeq = (top?.m ?? -1) + 1;

    const inserted = tx
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        parts: input.parts,
        metadata: input.metadata ?? null,
        status: input.status ?? "complete",
        seq: nextSeq,
      })
      .returning()
      .get();

    tx.update(conversations)
      .set({ updatedAt: Date.now() })
      .where(eq(conversations.id, input.conversationId))
      .run();

    return toDto(inserted);
  });
}

/** Liệt kê toàn bộ tin nhắn theo seq tăng dần. */
export function listMessages(db: DB, conversationId: string): MessageDto[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.seq))
    .all()
    .map(toDto);
}

/** Lấy một trang tin cũ với seq < beforeSeq; lấy dư một dòng để xác định hasMore. */
export function listMessagesPaginated(
  db: DB,
  conversationId: string,
  beforeSeq?: number,
  limit?: number,
): { messages: MessageDto[]; hasMore: boolean } {
  const where =
    beforeSeq != null
      ? and(eq(messages.conversationId, conversationId), lt(messages.seq, beforeSeq))
      : eq(messages.conversationId, conversationId);
  const query = db.select().from(messages).where(where).orderBy(desc(messages.seq));
  const rows = limit != null ? query.limit(limit + 1).all() : query.all();
  const hasMore = limit != null && rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { messages: page.reverse().map(toDto), hasMore };
}

/** Liệt kê tin sau afterSeq theo thứ tự tăng; null nghĩa là lấy tất cả. */
export function listMessagesAfterSeq(
  db: DB,
  conversationId: string,
  afterSeq: number | null,
): MessageDto[] {
  const where =
    afterSeq == null
      ? eq(messages.conversationId, conversationId)
      : and(eq(messages.conversationId, conversationId), gt(messages.seq, afterSeq));
  return db.select().from(messages).where(where).orderBy(asc(messages.seq)).all().map(toDto);
}

/** Tìm ngược tin người dùng gần nhất có chip đoạn văn và trả nội dung đó; thiếu thì null. */
export function getLastParagraphContent(db: DB, conversationId: string): string | null {
  const rows = db
    .select({ role: messages.role, metadata: messages.metadata })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.seq))
    .all();
  for (const r of rows) {
    if (r.role !== "user") continue;
    const meta = parseMetadata(r.metadata);
    const para = meta?.contextChips?.find((c) => c.id === "paragraph");
    if (para) return para.content;
  }
  return null;
}

/** Lấy DTO của một tin nhắn; không có thì null. */
export function getMessage(db: DB, messageId: string): MessageDto | null {
  const row = db.select().from(messages).where(eq(messages.id, messageId)).get();
  return row ? toDto(row) : null;
}

/**
 * Chuẩn bị gửi lại một lượt người dùng trong transaction: thay parts nhưng giữ metadata,
 * xóa các tin phía sau, đặt lại bản tóm tắt nếu nó chứa những tin đã xóa, cập nhật updatedAt.
 * Trả seq của lượt đó; bên gọi phải xác nhận messageId thuộc hội thoại này.
 */
export function resetUserTurnForResend(
  db: DB,
  conversationId: string,
  messageId: string,
  text: string,
): number {
  return db.transaction((tx) => {
    const row = tx
      .select({ seq: messages.seq })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .get();
    if (!row) throw new Error("message not found in conversation");
    const seq = row.seq;
    tx.update(messages)
      .set({ parts: [{ type: "text", text }] })
      .where(eq(messages.id, messageId))
      .run();
    tx.delete(messages)
      .where(and(eq(messages.conversationId, conversationId), gt(messages.seq, seq)))
      .run();
    const convo = tx
      .select({ s: conversations.summarizedThroughSeq })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    const resetSummary = convo?.s != null && convo.s >= seq;
    tx.update(conversations)
      .set({
        updatedAt: Date.now(),
        ...(resetSummary ? { contextSummary: null, summarizedThroughSeq: null } : {}),
      })
      .where(eq(conversations.id, conversationId))
      .run();
    return seq;
  });
}

/**
 * Khôi phục sau crash: nếu tin cuối là của người dùng thì lượt đó chưa được trả lời.
 * Không cần lưu thêm trạng thái chạy vì câu trả lời dở dang chưa được ghi vào DB.
 */
export function isLastTurnIncomplete(db: DB, conversationId: string): boolean {
  const last = db
    .select({ role: messages.role })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.seq))
    .limit(1)
    .get();
  return last?.role === "user";
}
