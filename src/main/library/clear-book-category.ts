import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import {
  annotations,
  bookNotes,
  books,
  pdfBookmarks,
  vocabularyEntries,
} from "@main/db/schema";
import type { ClearBookCategoryInput } from "@shared/library";

/** Clear one reader-data category from one book, leaving progress and all other categories intact. */
export function clearBookCategory(db: DB, input: ClearBookCategoryInput): number {
  const book = db
    .select({ format: books.format })
    .from(books)
    .where(eq(books.id, input.bookId))
    .get();
  if (!book) throw new Error(`reader:clear-book-category — book ${input.bookId} not found`);
  if (input.category === "bookmarks" && book.format !== "pdf") {
    throw new Error("PDF bookmarks can only be cleared for a PDF book.");
  }

  return db.transaction((tx) => {
    switch (input.category) {
      case "annotations":
        return tx
          .delete(annotations)
          .where(eq(annotations.bookId, input.bookId))
          .returning({ id: annotations.id })
          .all().length;
      case "vocabulary":
        return tx
          .delete(vocabularyEntries)
          .where(eq(vocabularyEntries.bookId, input.bookId))
          .returning({ id: vocabularyEntries.id })
          .all().length;
      case "bookmarks":
        return tx
          .delete(pdfBookmarks)
          .where(eq(pdfBookmarks.bookId, input.bookId))
          .returning({ id: pdfBookmarks.id })
          .all().length;
      case "notes":
        return tx
          .delete(bookNotes)
          .where(eq(bookNotes.bookId, input.bookId))
          .returning({ id: bookNotes.id })
          .all().length;
    }
  });
}
