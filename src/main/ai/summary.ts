// src/main/ai/summary.ts
import { generateText, streamText } from "ai";
import { and, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { books, chapters } from "@main/db/schema";
import { readBookText, readChapterText } from "@main/library/content";
import type { SummaryStatus } from "@shared/library";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { RunBackground } from "@main/ai/background-limiter";
import type { LoadBytes } from "@main/ai/tools";
import { createLogger } from "@main/logger";

const log = createLogger("summary");

export const SUMMARY_SYSTEM =
  "You summarize a single book chapter for a reading assistant. Produce a concise, faithful summary (a few sentences) capturing the chapter's key events, ideas, and terms. Output only the summary, no preamble.";

const SUMMARY_INPUT_MAX_CHARS = 180_000; // Giới hạn đầu vào tóm tắt chương; chương quá dài bỏ phần đầu.

export interface SummaryDeps {
  db: DB;
  loadBytes: LoadBytes;
  resolveModel: () => ResolvedModel;
  /** Giới hạn đồng thời cho cả bước tải nội dung và gọi model. */
  runBackground: RunBackground;
}

/**
 * Kiểm tra trước khi người dùng yêu cầu tạo tóm tắt. Nếu chưa có model, ném lỗi kèm lý do
 * để handler từ chối và renderer hiển thị thông báo cụ thể, ví dụ thiếu API key.
 * Nếu bỏ bước này, ensure* chỉ trả về và trạng thái pending không giải thích nguyên nhân.
 * Tác vụ tự chạy khi mở chương dùng cùng handler nhưng renderer không hiện toast khi lỗi.
 */
export function assertSummaryModelReady(resolveModel: () => ResolvedModel): void {
  const resolved = resolveModel();
  if (!resolved.ok) throw new Error(resolved.reason);
}

// Trạng thái tóm tắt chương chỉ ở bộ nhớ tiến trình, khởi động lại sẽ xóa.
// Có summary hợp lệ: ready; đang chạy: generating; lỗi: unavailable; còn lại: pending.
const inFlightChapters = new Set<string>();
const failedChapters = new Set<string>();

/**
 * Tóm tắt rỗng hoặc toàn khoảng trắng không hợp lệ. Provider có thể trả rỗng mà không ném lỗi.
 * Phiên bản cũ từng lưu giá trị đó, làm trạng thái luôn là ready; dùng điều kiện này để
 * dữ liệu cũ trở lại pending và được tạo lại.
 */
function hasText(s: string | null | undefined): s is string {
  return s != null && s.trim() !== "";
}

/**
 * Đọc nội dung tóm tắt chương và suy ra trạng thái, không lưu trạng thái vào DB.
 * Tóm tắt chương không stream nên khi generating chưa có nội dung tạm.
 */
export function getChapterSummaryView(
  db: DB,
  bookId: string,
  chapterId: string,
): { status: SummaryStatus; summary: string | null } {
  const row = db
    .select({ summary: chapters.summary })
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.id, chapterId)))
    .get();
  if (!row) throw new Error(`summary: chapter ${chapterId} not found in book ${bookId}`);
  if (inFlightChapters.has(chapterId)) return { status: "generating", summary: null };
  const summary = hasText(row.summary) ? row.summary : null;
  const status: SummaryStatus =
    summary != null ? "ready" : failedChapters.has(chapterId) ? "unavailable" : "pending";
  return { status, summary };
}

/** Chỉ dùng trong kiểm thử: xóa trạng thái tóm tắt chương để các ca không ảnh hưởng nhau. */
export function __resetChapterSummaryRuntime(): void {
  inFlightChapters.clear();
  failedChapters.clear();
}

/**
 * Tạo tóm tắt chương khi cần (thiết kế §11) trong tác vụ nền, không chặn bên gọi.
 * Chương lỗi sẽ thử lại ở lần sau; khởi động lại cũng xóa trạng thái lỗi tạm.
 * force=true bỏ qua trạng thái ready để tạo lại; mở chương tự động không truyền force.
 */
export async function ensureChapterSummary(
  deps: SummaryDeps,
  bookId: string,
  chapterId: string,
  force = false,
): Promise<void> {
  const { db, loadBytes, resolveModel, runBackground } = deps;
  let claimed = false;
  try {
    if (inFlightChapters.has(chapterId)) return; // Tránh chạy trùng.
    const stored = db
      .select({ summary: chapters.summary })
      .from(chapters)
      .where(and(eq(chapters.bookId, bookId), eq(chapters.id, chapterId)))
      .get();
    if (!stored) return; // Chương không tồn tại.
    if (!force && hasText(stored.summary)) return; // Đã có tóm tắt hợp lệ.
    const resolved = resolveModel();
    if (!resolved.ok) return; // Chưa có model: giữ pending để thử lại sau.

    failedChapters.delete(chapterId); // Xóa dấu lỗi cũ để thử lại.
    inFlightChapters.add(chapterId); // Đánh dấu ngay để handler thấy trạng thái generating.
    claimed = true;
    const text = await runBackground(async () => {
      const bytes = await loadBytes(bookId);
      const slice = await readChapterText(db, bytes, bookId, chapterId, {
        maxChars: SUMMARY_INPUT_MAX_CHARS,
      });
      const generated = await generateText({
        model: resolved.model,
        reasoning: resolved.reasoningEffort, // undefined dùng mặc định của provider.
        instructions: SUMMARY_SYSTEM,
        prompt: slice.text,
        maxOutputTokens: 512,
        maxRetries: 1,
      });
      return generated.text;
    });
    if (!hasText(text)) {
      // Kết quả rỗng vẫn là lỗi: không lưu DB, đánh dấu unavailable để có thể thử lại.
      log.warn(`chapter ${chapterId} generated empty text, treated as failure`);
      failedChapters.add(chapterId);
      return;
    }
    db.update(chapters).set({ summary: text }).where(eq(chapters.id, chapterId)).run();
  } catch (err) {
    // Xử lý mọi lỗi trong tác vụ nền; chương đã nhận xử lý được đánh dấu thất bại.
    log.warn(`chapter ${chapterId} ensure failed`, err);
    if (claimed) failedChapters.add(chapterId);
  } finally {
    if (claimed) inFlightChapters.delete(chapterId);
  }
}

export const BOOK_SUMMARY_SYSTEM =
  "You summarize an entire book for a reading assistant. Produce a faithful, multi-paragraph summary covering the book's core themes, main characters, and overall structure/arc. Output only the summary, no preamble.";

const BOOK_SUMMARY_INPUT_MAX_CHARS = 180_000; // Giới hạn nội dung sách gửi cho model; sách dài bỏ phần đầu.

// Trạng thái tóm tắt sách chỉ ở bộ nhớ: có nội dung là ready; đang chạy là generating; lỗi là unavailable.
const inFlightBooks = new Set<string>();
const failedBooks = new Set<string>();
const streamingBookSummaries = new Map<string, string>(); // Văn bản tạm tích lũy khi đang stream.

/**
 * Đọc tóm tắt sách và suy ra trạng thái mà không lưu trạng thái vào DB.
 * Khi đang tạo, trả văn bản tạm cho BookCard hiển thị qua Streamdown.
 * inFlight được ưu tiên hơn bản tóm tắt cũ để thao tác tạo lại hiện generating.
 */
export function getBookSummaryView(
  db: DB,
  bookId: string,
): { status: SummaryStatus; summary: string | null } {
  const row = db.select({ summary: books.summary }).from(books).where(eq(books.id, bookId)).get();
  if (!row) throw new Error(`summary: book ${bookId} not found`);
  if (inFlightBooks.has(bookId)) {
    return { status: "generating", summary: streamingBookSummaries.get(bookId) ?? null };
  }
  const summary = hasText(row.summary) ? row.summary : null;
  const status: SummaryStatus =
    summary != null ? "ready" : failedBooks.has(bookId) ? "unavailable" : "pending";
  return { status, summary };
}

/** Chỉ dùng trong kiểm thử: xóa trạng thái tóm tắt sách để các ca không ảnh hưởng nhau. */
export function __resetBookSummaryRuntime(): void {
  inFlightBooks.clear();
  failedBooks.clear();
  streamingBookSummaries.clear();
}

/**
 * Tạo tóm tắt toàn sách khi cần, tích lũy từng phần nội dung để renderer hiển thị.
 * force=true tạo lại ngay cả khi đã ready; tác vụ chạy nền và không chặn bên gọi.
 */
export async function ensureBookSummary(
  deps: SummaryDeps,
  bookId: string,
  force = false,
): Promise<void> {
  const { db, loadBytes, resolveModel, runBackground } = deps;
  let claimed = false;
  try {
    if (inFlightBooks.has(bookId)) return; // Tránh chạy trùng.
    const stored = db
      .select({ summary: books.summary })
      .from(books)
      .where(eq(books.id, bookId))
      .get();
    if (!force && hasText(stored?.summary)) return; // Đã có tóm tắt hợp lệ.
    const resolved = resolveModel();
    if (!resolved.ok) return; // Chưa có model: giữ pending để thử lại sau.

    failedBooks.delete(bookId);
    streamingBookSummaries.delete(bookId);
    inFlightBooks.add(bookId); // Đánh dấu ngay để handler thấy generating.
    claimed = true;
    const produced = await runBackground(async () => {
      const bytes = await loadBytes(bookId);
      const { text } = await readBookText(db, bytes, bookId, {
        maxChars: BOOK_SUMMARY_INPUT_MAX_CHARS,
      });
      // textStream có thể đóng bình thường sau chunk lỗi; onError giúp tránh lưu nội dung dở dang.
      let hadError = false;
      const result = streamText({
        model: resolved.model,
        reasoning: resolved.reasoningEffort, // undefined dùng mặc định của provider.
        instructions: BOOK_SUMMARY_SYSTEM,
        prompt: text,
        maxOutputTokens: 4096, // Tóm tắt cả sách cần đủ chỗ cho chủ đề, nhân vật và cấu trúc.
        maxRetries: 1,
        onError: ({ error }) => {
          hadError = true;
          log.warn(`book ${bookId} stream error`, error);
        },
      });
      let acc = "";
      for await (const delta of result.textStream) {
        acc += delta;
        streamingBookSummaries.set(bookId, acc); // getBookSummaryView đọc nội dung tạm.
      }
      return { acc, hadError };
    });
    if (produced.hadError || !hasText(produced.acc)) {
      // Lỗi stream hoặc kết quả rỗng: giữ tóm tắt cũ, không lưu mới, cho phép thử lại.
      if (!produced.hadError) log.warn(`book ${bookId} generated empty text, treated as failure`);
      failedBooks.add(bookId);
    } else db.update(books).set({ summary: produced.acc }).where(eq(books.id, bookId)).run();
  } catch (err) {
    log.warn(`book ${bookId} ensure failed`, err);
    if (claimed) failedBooks.add(bookId);
  } finally {
    if (claimed) {
      inFlightBooks.delete(bookId);
      streamingBookSummaries.delete(bookId); // Nội dung tạm đã được lưu hoặc bỏ.
    }
  }
}
