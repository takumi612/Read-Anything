// src/renderer/query/book-note-queries.ts
import type { BookNoteDto } from "@shared/book-notes";
import { qk } from "@renderer/query/keys";

/** Truy vấn ghi chú sách dùng chung cho tab thanh bên và hộp thoại thư viện; dùng staleTime mặc định. */
export function bookNotesQuery(bookId: string) {
  return {
    queryKey: qk.bookNotes(bookId),
    queryFn: (): Promise<BookNoteDto[]> => window.api.bookNotes.listByBook({ bookId }),
  } as const;
}
