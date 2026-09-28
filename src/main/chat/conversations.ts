// src/main/chat/conversations.ts
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { conversations, messages } from "@main/db/schema";
import { isNamingConversation } from "@main/chat/conversation-title";
import type { ConversationDto, CreateConversationInput } from "@shared/chat";
import { dropAgentContext } from "@main/ai/agent-context";

type ConversationRow = typeof conversations.$inferSelect;

function toDto(row: ConversationRow): ConversationDto {
  return {
    id: row.id,
    bookId: row.bookId,
    title: row.title ?? null,
    isNaming: isNamingConversation(row.id),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Tạo hội thoại cho sách hoặc thư viện. Nếu đã có hội thoại rỗng cùng ngữ cảnh,
 * dùng lại hội thoại mới nhất để không tích tụ bản ghi rỗng.
 */
export function createConversation(db: DB, input: CreateConversationInput): ConversationDto {
  const bookId = input.bookId ?? null;
  const bookMatch =
    bookId === null ? isNull(conversations.bookId) : eq(conversations.bookId, bookId);
  const empty = db
    .select({ row: conversations })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(and(bookMatch, isNull(messages.id)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1)
    .get();
  if (empty) return toDto(empty.row);

  const row = db.insert(conversations).values({ bookId }).returning().get();
  return toDto(row);
}

export function getConversation(db: DB, id: string): ConversationDto | null {
  const row = db.select().from(conversations).where(eq(conversations.id, id)).get();
  return row ? toDto(row) : null;
}

/** Đặt tiêu đề hội thoại, hiện dùng cho tự đặt tên và có thể dùng cho sửa thủ công. */
export function setConversationTitle(db: DB, id: string, title: string): void {
  db.update(conversations).set({ title }).where(eq(conversations.id, id)).run();
}

/** Xóa hội thoại; tin nhắn bị xóa theo khóa ngoại. ID lạ không gây lỗi. */
export function deleteConversation(db: DB, id: string): void {
  db.delete(conversations).where(eq(conversations.id, id)).run();
  dropAgentContext(id);
}

/** Liệt kê hội thoại của sách, hoặc thư viện khi bookId null; mới cập nhật đứng trước. */
export function listConversationsByBook(db: DB, bookId: string | null): ConversationDto[] {
  const match = bookId === null ? isNull(conversations.bookId) : eq(conversations.bookId, bookId);
  return db
    .select()
    .from(conversations)
    .where(match)
    .orderBy(desc(conversations.updatedAt))
    .all()
    .map(toDto);
}
