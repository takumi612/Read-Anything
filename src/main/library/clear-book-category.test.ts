import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "@main/db/client";
import {
  annotations,
  bookNotes,
  books,
  pdfBookmarks,
  progress,
  vocabularyEntries,
  vocabularyOverrides,
} from "@main/db/schema";
import { clearBookCategory } from "./clear-book-category";

const MIGRATIONS = path.resolve(__dirname, "../db/migrations");

function freshDb() {
  const db = createDb(":memory:");
  runMigrations(db, MIGRATIONS);
  db.insert(books)
    .values([
      { id: "book-1", format: "pdf", pageCount: 10 },
      { id: "book-2", format: "pdf", pageCount: 10 },
    ])
    .run();
  return db;
}

function addRows(db: ReturnType<typeof freshDb>, bookId: string) {
  db.insert(annotations)
    .values({ bookId, style: "yellow", selectedText: "selected", locatorRange: "page:1" })
    .run();
  const [entry] = db
    .insert(vocabularyEntries)
    .values({
      bookId,
      term: "runtime",
      normalizedTerm: "runtime",
      meaning: "execution environment",
      context: "runtime context",
      sourcePage: 1,
    })
    .returning()
    .all();
  db.insert(vocabularyOverrides)
    .values({ entryId: entry.id, page: 1, start: 0, end: 7, meaning: "custom meaning" })
    .run();
  db.insert(pdfBookmarks).values({ bookId, title: "Review", page: 1 }).run();
  db.insert(bookNotes).values({ bookId, content: "A note" }).run();
  db.insert(progress).values({ bookId, locator: "page:1", percent: 0.1 }).run();
}

describe("clearBookCategory", () => {
  it.each([
    ["annotations", annotations],
    ["vocabulary", vocabularyEntries],
    ["bookmarks", pdfBookmarks],
    ["notes", bookNotes],
  ] as const)("clears only %s for the selected book", (category, table) => {
    const db = freshDb();
    addRows(db, "book-1");
    addRows(db, "book-2");

    expect(clearBookCategory(db, { bookId: "book-1", category })).toBe(1);
    expect(
      db.select().from(table).where(eq(table.bookId, "book-1")).all(),
    ).toHaveLength(0);
    expect(db.select().from(table).where(eq(table.bookId, "book-2")).all()).toHaveLength(1);
    expect(db.select().from(progress).where(eq(progress.bookId, "book-1")).all()).toHaveLength(1);
    for (const otherCategory of ["annotations", "vocabulary", "bookmarks", "notes"] as const) {
      if (otherCategory === category) continue;
      const otherTable = {
        annotations,
        vocabulary: vocabularyEntries,
        bookmarks: pdfBookmarks,
        notes: bookNotes,
      }[otherCategory];
      expect(db.select().from(otherTable).where(eq(otherTable.bookId, "book-1")).all()).toHaveLength(1);
    }
    if (category === "vocabulary") {
      expect(db.select().from(vocabularyOverrides).all()).toHaveLength(1);
    }
  });

  it("rejects bookmarks for EPUBs and unknown books", () => {
    const db = freshDb();
    db.insert(books).values({ id: "epub-1", format: "epub" }).run();
    expect(() => clearBookCategory(db, { bookId: "epub-1", category: "bookmarks" })).toThrow(
      /PDF/i,
    );
    expect(() => clearBookCategory(db, { bookId: "missing", category: "notes" })).toThrow(
      /book/i,
    );
  });
});
