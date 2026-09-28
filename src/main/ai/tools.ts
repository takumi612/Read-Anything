// src/main/ai/tools.ts
import { tool } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { chapters } from "@main/db/schema";
import { listChapters, readChapterText } from "@main/library/content";
import { getBook, resolveChapterByHref } from "@main/library/repository";
import { extractPdfText, renderPageImage } from "@marginalia/pdf-parser";
import { createLogger } from "@main/logger";
import { retrievePdfEvidence } from "@main/ai/pdf-retrieval";

const log = createLogger("tools");

/** Lấy bytes sách gốc; bản thật đọc từ thư mục ứng dụng, kiểm thử truyền bytes mẫu. */
export type LoadBytes = (bookId: string) => Promise<Uint8Array>;

export interface ReadingToolsDeps {
  db: DB;
  bookId: string;
  loadBytes: LoadBytes;
  /** Provider có hỗ trợ kết quả công cụ dạng ảnh không; mặc định là không. */
  imageToolResults?: boolean;
}

/** Chiều rộng ảnh trang gửi model, cân bằng khả năng đọc và chi phí token. */
const READ_PAGE_IMAGE_WIDTH = 1280;

/**
 * Chuyển tham chiếu chương từ model thành chapterId chuẩn. Chấp nhận UUID, href từ getToc
 * hoặc tiêu đề khớp duy nhất không phân biệt hoa thường; model đôi khi gửi href/tiêu đề thay ID.
 * Nếu không tìm thấy, lỗi kèm danh sách chương thật để model có thể thử lại.
 */
export function resolveChapterRef(db: DB, bookId: string, ref: string): string {
  const byId = db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.id, ref)))
    .get();
  if (byId) return byId.id;
  const byHref = resolveChapterByHref(db, bookId, ref);
  if (byHref) return byHref.id;
  const all = db
    .select({ id: chapters.id, title: chapters.title })
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .all();
  const wanted = ref.trim().toLowerCase();
  const byTitle = all.filter((c) => (c.title ?? "").trim().toLowerCase() === wanted);
  if (byTitle.length === 1) return byTitle[0]!.id;
  const sample = all
    .slice(0, 8)
    .map((c) => `${c.id} ("${c.title ?? "untitled"}")`)
    .join(", ");
  throw new Error(
    `chapter not found by id, href, or unique title: "${ref}". Call getToc and pass the exact id field. Known chapters include: ${sample}${all.length > 8 ? ", …" : ""}`,
  );
}

/**
 * Lỗi công cụ được trả thành `{ error }` thay vì ném ra để không ngắt luồng trả lời.
 * Model nhìn thấy lỗi và có thể đổi tham số rồi gọi lại công cụ.
 */
export async function runTool<T>(
  name: string,
  fn: () => Promise<T> | T,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    log.warn(`tool ${name} failed (error returned to model for self-correction)`, err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Công cụ đọc sách hiện tại, chỉ đọc và chạy ở main trước khi đưa vào streamText. */
export function createReadingTools(deps: ReadingToolsDeps) {
  const { db, bookId, loadBytes } = deps;

  const base = {
    getToc: tool({
      description:
        "List the book's chapters with their ids and titles. Use the returned `id` field as the chapterId for readChapterText.",
      inputSchema: z.object({}),
      execute: async () => listChapters(db, bookId),
    }),
    readChapterText: tool({
      description:
        "Read the verbatim text of a chapter (id from getToc), paginated by character offset; returns { text, hasMore, nextOffset }.",
      inputSchema: z.object({
        chapterId: z.string().min(1),
        offset: z.number().int().nonnegative().optional(),
        maxChars: z.number().int().positive().optional(),
      }),
      execute: async ({ chapterId, offset, maxChars }) =>
        runTool("readChapterText", async () => {
          const id = resolveChapterRef(db, bookId, chapterId);
          const bytes = await loadBytes(bookId);
          return await readChapterText(db, bytes, bookId, id, { offset, maxChars });
        }),
    }),
  };

  const book = getBook(db, bookId);
  if (book?.format !== "pdf") return base;

  const pageCount = book.pageCount ?? 0;
  const hasTextLayer = Boolean(book.hasTextLayer);
  const imageOk = deps.imageToolResults ?? false;
  // Chỉ khai báo mode image trong schema nếu provider hỗ trợ kết quả ảnh.
  // Kiểu đầy đủ cho execute vẫn bao gồm cả hai mode.
  const modes = (imageOk ? ["text", "image"] : ["text"]) as ["text", "image"];

  return {
    ...base,
    ...(hasTextLayer
      ? {
          searchPdf: tool({
            description:
              "Search the entire current PDF locally for relevant passages. Returns short excerpts with 1-based page numbers. Use when a question needs evidence beyond the selected sentence or current page.",
            inputSchema: z.object({ query: z.string().trim().min(2).max(500) }),
            execute: async ({ query }) =>
              runTool("searchPdf", () => retrievePdfEvidence(bookId, loadBytes, "", query)),
          }),
        }
      : {}),
    readPage: tool({
      description: imageOk
        ? 'Read one page of this PDF by 1-based page number. mode "text" returns the page text; mode "image" returns a rendered image of the page — use it for figures, tables, complex layouts, or scanned pages.'
        : "Read one page of this PDF by 1-based page number, returning the page text.",
      inputSchema: z.object({
        page: z.number().int().min(1),
        mode: z.enum(modes).default("text"),
      }),
      execute: async ({ page, mode }) =>
        runTool("readPage", async () => {
          if (page > pageCount) {
            throw new Error(`page ${page} is out of range (this book has ${pageCount} pages)`);
          }
          const bytes = await loadBytes(bookId);
          if (mode === "image") {
            const png = await renderPageImage(bytes, page, { targetWidth: READ_PAGE_IMAGE_WIDTH });
            return { kind: "image" as const, page, data: Buffer.from(png).toString("base64") };
          }
          if (!hasTextLayer) {
            throw new Error(
              `this PDF is scanned and has no text layer; text extraction is unavailable${
                imageOk ? ' — use mode "image" instead' : ""
              }`,
            );
          }
          const slice = await extractPdfText(bytes, { startPage: page, endPage: page });
          return { kind: "text" as const, page, text: slice.text };
        }),
      // Trả ảnh qua content part; JSON thông thường chỉ biến base64 thành văn bản dài.
      // Kết quả text và lỗi `{ error }` vẫn đi qua JSON.
      toModelOutput: ({ output }) =>
        "kind" in output && output.kind === "image"
          ? {
              type: "content" as const,
              value: [{ type: "file-data" as const, mediaType: "image/png", data: output.data }],
            }
          : {
              type: "json" as const,
              value: "kind" in output ? { page: output.page, text: output.text } : output,
            },
    }),
  };
}
