import { asc, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { books, pdfBookmarks } from "@main/db/schema";
import type { PdfBookmarkDto } from "@shared/pdf-bookmarks";

export function listPdfBookmarks(db: DB, bookId: string): PdfBookmarkDto[] {
  return db
    .select()
    .from(pdfBookmarks)
    .where(eq(pdfBookmarks.bookId, bookId))
    .orderBy(asc(pdfBookmarks.page), asc(pdfBookmarks.scrollRatio), asc(pdfBookmarks.createdAt))
    .all();
}

export function createPdfBookmark(
  db: DB,
  input: { bookId: string; title: string; page: number; scrollRatio: number },
): PdfBookmarkDto {
  const book = db
    .select({ format: books.format, pageCount: books.pageCount })
    .from(books)
    .where(eq(books.id, input.bookId))
    .get();
  if (book?.format !== "pdf" || input.page > (book.pageCount ?? 0)) {
    throw new Error("PDF bookmark page is out of range");
  }
  return db.insert(pdfBookmarks).values(input).returning().get();
}

export function renamePdfBookmark(db: DB, id: string, title: string): PdfBookmarkDto {
  const row = db
    .update(pdfBookmarks)
    .set({ title: title.trim(), updatedAt: Date.now() })
    .where(eq(pdfBookmarks.id, id))
    .returning()
    .get();
  if (!row) throw new Error("PDF bookmark not found");
  return row;
}

export function deletePdfBookmark(db: DB, id: string): void {
  db.delete(pdfBookmarks).where(eq(pdfBookmarks.id, id)).run();
}
