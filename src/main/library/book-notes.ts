import { desc, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { bookNotes, books } from "@main/db/schema";
import type { BookNoteDto, CreateBookNoteInput, UpdateBookNoteInput } from "@shared/book-notes";

type BookNoteRow = typeof bookNotes.$inferSelect;

function toDto(row: BookNoteRow): BookNoteDto {
  return {
    id: row.id,
    bookId: row.bookId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Liệt kê ghi chú của sách theo thời gian tạo giảm dần, mới nhất trước. */
export function listBookNotesByBook(db: DB, bookId: string): BookNoteDto[] {
  return db
    .select()
    .from(bookNotes)
    .where(eq(bookNotes.bookId, bookId))
    .orderBy(desc(bookNotes.createdAt))
    .all()
    .map(toDto);
}

/** Tạo ghi chú; sách không tồn tại thì ném lỗi dễ đọc. */
export function createBookNote(db: DB, input: CreateBookNoteInput): BookNoteDto {
  const book = db.select({ id: books.id }).from(books).where(eq(books.id, input.bookId)).get();
  if (!book) throw new Error(`createBookNote: book ${input.bookId} not found`);
  const row = db
    .insert(bookNotes)
    .values({ bookId: input.bookId, content: input.content })
    .returning()
    .get();
  return toDto(row);
}

/** Sửa nội dung và updatedAt; thiếu ghi chú thì ném lỗi dễ đọc. */
export function updateBookNote(db: DB, input: UpdateBookNoteInput): BookNoteDto {
  const row = db
    .update(bookNotes)
    .set({ content: input.patch.content, updatedAt: Date.now() })
    .where(eq(bookNotes.id, input.id))
    .returning()
    .get();
  if (!row) throw new Error(`updateBookNote: book note ${input.id} not found`);
  return toDto(row);
}

/** Xóa ghi chú; thiếu dòng thì báo lỗi, khác với hành vi idempotent của annotation. */
export function deleteBookNote(db: DB, id: string): void {
  const res = db.delete(bookNotes).where(eq(bookNotes.id, id)).run();
  if (res.changes === 0) throw new Error(`deleteBookNote: book note ${id} not found`);
}
