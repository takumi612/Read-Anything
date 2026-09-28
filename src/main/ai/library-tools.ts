// Công cụ thư viện chỉ đọc cho ngữ cảnh library; nhận DB từ bên ngoài.
// Lỗi thành `{ error }` để model có thể tự thử lại.
import { tool } from "ai";
import { z } from "zod";
import type { DB } from "@main/db/client";
import { runTool } from "@main/ai/tools";
import { listBooks, listRecentlyRead, getBook } from "@main/library/repository";
import { getBookReadingState } from "@main/reading-sessions/repository";
import { listBookNotesByBook } from "@main/library/book-notes";
import { listAnnotationsByBook } from "@main/library/annotations";
import { aggregateReadingStats } from "@main/stats/aggregate";

export interface LibraryToolsDeps {
  db: DB;
}

export function createLibraryTools(deps: LibraryToolsDeps) {
  const { db } = deps;
  return {
    listBooks: tool({
      description:
        "List every book in the reader's library with reading state. Returns id, title, author, format, readingState, progressPercent (0–1 or null), lastReadAt (ms or null). Start here to ground any recommendation or discussion.",
      inputSchema: z.object({}),
      execute: async () => {
        const recent = new Map(listRecentlyRead(db, Number.MAX_SAFE_INTEGER).map((r) => [r.id, r]));
        return listBooks(db).map((b) => {
          const r = recent.get(b.id);
          return {
            id: b.id,
            title: b.title,
            author: b.author,
            format: b.format,
            readingState: b.readingState,
            progressPercent: r?.percent ?? null,
            lastReadAt: r?.lastReadAt ?? null,
          };
        });
      },
    }),
    getBook: tool({
      description:
        "Get one book's details by its id (from listBooks): title, author, format, pageCount, readingState, and addedAt.",
      inputSchema: z.object({ bookId: z.string().min(1) }),
      execute: async ({ bookId }) =>
        runTool("getBook", () => {
          const book = getBook(db, bookId);
          if (!book) {
            throw new Error(`book not found: "${bookId}". Call listBooks and pass an exact id.`);
          }
          return {
            title: book.title,
            author: book.author,
            format: book.format,
            pageCount: book.pageCount,
            readingState: getBookReadingState(db, bookId),
            addedAt: book.addedAt,
          };
        }),
    }),
    getBookNotes: tool({
      description: "Get the reader's free-form Markdown notes for one book (id from listBooks).",
      inputSchema: z.object({ bookId: z.string().min(1) }),
      execute: async ({ bookId }) => runTool("getBookNotes", () => listBookNotesByBook(db, bookId)),
    }),
    listAnnotations: tool({
      description:
        "List the reader's highlights/annotations for one book (id from listBooks): selectedText, note, style.",
      inputSchema: z.object({ bookId: z.string().min(1) }),
      execute: async ({ bookId }) =>
        runTool("listAnnotations", () =>
          listAnnotationsByBook(db, bookId).map((a) => ({
            selectedText: a.selectedText,
            note: a.note,
            style: a.style,
          })),
        ),
    }),
    getReadingStats: tool({
      description:
        "Get the reader's reading-time stats: total seconds, current streak, and per-book seconds. Use to gauge engagement and what they've been into lately.",
      inputSchema: z.object({}),
      execute: async () => runTool("getReadingStats", () => aggregateReadingStats(db)),
    }),
  };
}
