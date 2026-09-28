import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { t } from "@main/i18n";
import {
  annotations,
  bookNotes,
  books,
  chapters,
  conversations,
  pdfBookmarks,
  progress,
  readingDaily,
  readingPageVisits,
  readingSessions,
  vocabularyEntries,
} from "@main/db/schema";

/** Remove one PDF's local reading data while keeping the imported PDF and its metadata. */
export function clearPdfReadingData(db: DB, bookId: string): string[] {
  const book = db.select({ format: books.format }).from(books).where(eq(books.id, bookId)).get();
  if (book?.format !== "pdf") throw new Error(t("errors.pdfNotFound"));
  const conversationIds = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.bookId, bookId))
    .all()
    .map(({ id }) => id);
  db.transaction((tx) => {
    tx.delete(annotations).where(eq(annotations.bookId, bookId)).run();
    tx.delete(vocabularyEntries).where(eq(vocabularyEntries.bookId, bookId)).run();
    tx.delete(pdfBookmarks).where(eq(pdfBookmarks.bookId, bookId)).run();
    tx.delete(bookNotes).where(eq(bookNotes.bookId, bookId)).run();
    tx.delete(conversations).where(eq(conversations.bookId, bookId)).run();
    tx.delete(progress).where(eq(progress.bookId, bookId)).run();
    tx.delete(readingDaily).where(eq(readingDaily.bookId, bookId)).run();
    tx.delete(readingPageVisits).where(eq(readingPageVisits.bookId, bookId)).run();
    tx.delete(readingSessions).where(eq(readingSessions.bookId, bookId)).run();
    tx.update(chapters).set({ summary: null }).where(eq(chapters.bookId, bookId)).run();
    tx.update(books).set({ summary: null }).where(eq(books.id, bookId)).run();
  });
  return conversationIds;
}
