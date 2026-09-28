import path from "node:path";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { C } from "@shared/ipc";
import type { BookSummaryDto, SaveProgressInput } from "@shared/library";
import { getDb } from "@main/db/instance";
import { appService } from "@main/app";
import {
  deleteBook,
  getBook,
  importBook,
  listBooks,
  listRecentlyRead,
  reindexBookIfStale,
  reorderBooks,
  updateBook,
  CURRENT_PARSER_VERSION,
} from "@main/library/repository";
import {
  readBookFile,
  readBookFileResult,
  relinkBookFile,
  writeBookFile,
} from "@main/library/book-files";
import { writePdfExport } from "@main/library/export-pdf";
import { readBookBytes } from "@main/library/import-source";
import {
  getConfirmedProgress,
  getProgress,
  maxProgressPercent,
  saveProgress,
} from "@main/library/progress";
import { assertTextLayer, getToc, listChapters, readChapterText } from "@main/library/content";
import {
  assertSummaryModelReady,
  ensureBookSummary,
  ensureChapterSummary,
  getBookSummaryView,
  getChapterSummaryView,
} from "@main/ai/summary";
import { makeSummaryDeps } from "@main/ai/send-deps";
import { abortConversationStreams } from "@main/ipc/ai-handlers";
import { bind, register, type Binding } from "@main/ipc/registry";
import { createLogger } from "@main/logger";
import { getBookReadingState } from "@main/reading-sessions/repository";
import {
  createPdfBookmark,
  deletePdfBookmark,
  listPdfBookmarks,
  renamePdfBookmark,
} from "@main/library/pdf-bookmarks";
import { clearPdfReadingData } from "@main/library/clear-pdf-data";
import { clearBookCategory } from "@main/library/clear-book-category";

const log = createLogger("library");

function persistReadingProgress(input: SaveProgressInput): void {
  const db = getDb();
  if (!getBook(db, input.bookId)) throw new Error(`progress:save — book ${input.bookId} not found`);
  // A debounced final position can arrive just after the session is completed.
  // The reader gates new saves by its active-mode prop; preserve that last snapshot.
  saveProgress(db, input.bookId, input.locator);
}

/** Khi mở EPUB cũ, đọc bytes và dựng lại chỉ mục nếu phiên bản parser thấp; lỗi không chặn mở sách. */
async function ensureEpubIndexed(bookId: string): Promise<void> {
  const db = getDb();
  const book = getBook(db, bookId);
  if (!book || book.format !== "epub") return;
  if ((book.parserVersion ?? 0) >= CURRENT_PARSER_VERSION) return; // Bản mới không cần đọc lại bytes.
  try {
    const bytes = await readBookFile(appService.getPath("booksDir"), bookId, book.format);
    reindexBookIfStale(db, bytes, bookId);
  } catch (err) {
    log.warn(`ensureEpubIndexed failed (book ${bookId})`, err);
  }
}

const toDto = (b: {
  id: string;
  title: string | null;
  author: string | null;
  hasCover: boolean;
  format: "epub" | "pdf";
  pageCount: number | null;
  hasTextLayer: boolean;
  readingState: import("@shared/reading-sessions").BookReadingState;
}): BookSummaryDto => ({
  id: b.id,
  title: b.title,
  author: b.author,
  hasCover: Boolean(b.hasCover),
  format: b.format,
  pageCount: b.pageCount,
  hasTextLayer: Boolean(b.hasTextLayer),
  readingState: b.readingState,
});

export const libraryBindings: Binding[] = [
  bind(C.pdfBookmarksList, ({ bookId }) => listPdfBookmarks(getDb(), bookId)),
  bind(C.pdfBookmarksCreate, (input) => createPdfBookmark(getDb(), input)),
  bind(C.pdfBookmarksRename, ({ id, title }) => renamePdfBookmark(getDb(), id, title)),
  bind(C.pdfBookmarksDelete, ({ id }) => deletePdfBookmark(getDb(), id)),
  bind(C.libraryImport, async (input) => {
    const bytes = await readBookBytes(input.filePath);
    const book = await importBook(getDb(), { bytes, fileName: path.basename(input.filePath) });
    await writeBookFile(appService.getPath("booksDir"), book.id, book.format, bytes); // Lưu bản sao của ứng dụng.
    log.info(`book imported: ${book.id} (${book.format}, ${Math.round(bytes.length / 1024)}KB)`);
    return toDto({
      ...book,
      hasCover: book.cover != null && book.cover.length > 0,
      readingState: getBookReadingState(getDb(), book.id),
    });
  }),

  bind(C.libraryPickBook, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      properties: ["openFile" as const],
      filters: [{ name: "Books", extensions: ["epub", "pdf"] }],
    };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  }),

  bind(C.libraryList, () => listBooks(getDb()).map(toDto)),

  bind(C.libraryGet, (input) => {
    const b = getBook(getDb(), input.bookId);
    return b
      ? toDto({
          ...b,
          hasCover: b.cover != null && b.cover.length > 0,
          readingState: getBookReadingState(getDb(), b.id),
        })
      : null;
  }),

  bind(C.libraryReadBookBytes, async (input) => {
    const db = getDb();
    const book = getBook(db, input.bookId);
    if (!book) throw new Error(`library: book ${input.bookId} not found`);
    await ensureEpubIndexed(input.bookId);
    return readBookFileResult(appService.getPath("booksDir"), input.bookId, book.format);
  }),

  bind(C.libraryExportAnnotatedPdf, async (input) => {
    const book = getBook(getDb(), input.bookId);
    if (!book || book.format !== "pdf") throw new Error("Không tìm thấy tài liệu PDF cần xuất.");
    const safeName = (book.title ?? "document")
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "-")
      .replace(/[. ]+$/gu, "")
      .trim();
    const defaultPath = `${safeName || "document"}-annotated.pdf`;
    const win = BrowserWindow.getFocusedWindow();
    const options = {
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    };
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { status: "canceled" as const };
    const destination =
      path.extname(result.filePath).toLowerCase() === ".pdf"
        ? result.filePath
        : `${result.filePath}.pdf`;
    await writePdfExport(destination, input.bytes);
    log.info(`annotated PDF exported (${input.bytes.byteLength} bytes)`);
    return { status: "saved" as const };
  }),

  bind(C.libraryDelete, (input) =>
    deleteBook(getDb(), appService.getPath("booksDir"), input.bookId),
  ),
  bind(C.libraryClearPdfData, ({ bookId }) => {
    const conversationIds = clearPdfReadingData(getDb(), bookId);
    for (const id of conversationIds) abortConversationStreams(id);
    log.info(`local PDF reading data cleared: ${bookId}`);
    return conversationIds;
  }),
  bind(C.readerClearBookCategory, (input) => clearBookCategory(getDb(), input)),

  bind(C.libraryRelink, async (input) => {
    const db = getDb();
    const book = getBook(db, input.bookId);
    if (!book) throw new Error(`library: book ${input.bookId} not found`);
    const win = BrowserWindow.getFocusedWindow();
    const opts = {
      properties: ["openFile" as const],
      filters: [{ name: "Books", extensions: ["epub", "pdf"] }],
    };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (r.canceled || r.filePaths.length === 0) return { status: "canceled" as const };
    const bytes = await readBookBytes(r.filePaths[0]!);
    const result = await relinkBookFile(
      appService.getPath("booksDir"),
      input.bookId,
      book.format,
      bytes,
    );
    if (result === "ok") log.info(`book relinked: ${input.bookId}`);
    else log.warn(`relink rejected (content mismatch) for book ${input.bookId}`);
    return { status: result };
  }),

  bind(C.libraryUpdate, (input) => {
    const book = updateBook(getDb(), input);
    return toDto({
      ...book,
      hasCover: book.cover != null && book.cover.length > 0,
      readingState: getBookReadingState(getDb(), book.id),
    });
  }),

  // Dùng toDto chung cho dữ liệu kệ sách để hasCover và các trường tiến độ nhất quán.
  bind(C.libraryRecentlyRead, () =>
    listRecentlyRead(getDb()).map((r) => ({
      ...toDto(r),
      percent: r.percent,
      lastReadAt: r.lastReadAt,
    })),
  ),

  bind(C.libraryReorder, (input) => reorderBooks(getDb(), input.orderedIds)),

  bind(C.progressGet, (input) => {
    const p = getProgress(getDb(), input.bookId);
    const confirmed = getConfirmedProgress(getDb(), input.bookId);
    return p || confirmed
      ? {
          locator: p?.locator ?? null,
          percent: maxProgressPercent(p?.percent, confirmed?.percent),
        }
      : null;
  }),

  bind(C.progressSave, persistReadingProgress),

  bind(C.contentToc, async (input) => {
    const db = getDb();
    if (!getBook(db, input.bookId)) throw new Error(`content: book ${input.bookId} not found`);
    await ensureEpubIndexed(input.bookId);
    return getToc(db, input.bookId);
  }),

  bind(C.contentChapters, async (input) => {
    const db = getDb();
    if (!getBook(db, input.bookId)) throw new Error(`content: book ${input.bookId} not found`);
    await ensureEpubIndexed(input.bookId);
    return listChapters(db, input.bookId);
  }),

  bind(C.contentChapterSummary, (input) =>
    getChapterSummaryView(getDb(), input.bookId, input.chapterId),
  ),

  // Tạo tóm tắt chương khi mở chương hoặc khi người dùng yêu cầu.
  // ensureChapterSummary chạy nền nhưng đánh dấu generating đồng bộ để UI phản hồi ngay.
  // Chỉ thao tác thủ công mới truyền force để tạo lại tóm tắt đã có.
  // Kiểm tra model trước; nếu chưa cấu hình, trả lỗi có lý do cho UI.
  bind(C.contentGenerateChapterSummary, (input) => {
    const db = getDb();
    const deps = makeSummaryDeps();
    assertSummaryModelReady(deps.resolveModel);
    assertTextLayer(db, input.bookId);
    void ensureChapterSummary(deps, input.bookId, input.chapterId, input.force ?? false).catch(
      (err) => log.warn("generate chapter summary failed", err),
    );
    return getChapterSummaryView(db, input.bookId, input.chapterId);
  }),

  bind(C.contentBookSummary, (input) => getBookSummaryView(getDb(), input.bookId)),

  // Tạo tóm tắt toàn sách theo yêu cầu; đánh dấu generating trước khi trả về.
  bind(C.contentGenerateBookSummary, (input) => {
    const db = getDb();
    const deps = makeSummaryDeps();
    assertSummaryModelReady(deps.resolveModel); // Trả lỗi có lý do nếu chưa cấu hình model.
    assertTextLayer(db, input.bookId);
    // Nút tạo/tạo lại trên thẻ sách luôn dùng force=true.
    void ensureBookSummary(deps, input.bookId, true).catch((err) =>
      log.warn("generate book summary failed", err),
    );
    return getBookSummaryView(db, input.bookId);
  }),

  bind(C.contentChapterText, async (input) => {
    const db = getDb();
    const book = getBook(db, input.bookId);
    if (!book) throw new Error(`content: book ${input.bookId} not found`);
    await ensureEpubIndexed(input.bookId);
    // Thiếu tệp thì trả BookFileMissingError; lỗi hệ điều hành khác được truyền nguyên dạng.
    const bytes = await readBookFile(appService.getPath("booksDir"), input.bookId, book.format);
    return await readChapterText(db, bytes, input.bookId, input.chapterId, {
      offset: input.offset,
      maxChars: input.maxChars,
    });
  }),
];

export function registerLibraryHandlers(): void {
  register(libraryBindings);
  // Flush the latest scroll position while the window is closing. This handler must finish
  // synchronously because an invoke queued by the renderer can be dropped on teardown.
  ipcMain.on(C.progressSaveSync.channel, (event, raw: unknown) => {
    event.returnValue = false;
    const parsed = C.progressSaveSync.input.safeParse(raw);
    if (!parsed.success) return;
    try {
      persistReadingProgress(parsed.data);
      event.returnValue = true;
    } catch (error) {
      log.warn("synchronous progress save failed", error);
    }
  });
}
