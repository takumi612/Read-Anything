import { openPdf, pageText } from "./parse";
import type { ChapterTextSlice } from "./types";

export interface PdfReadOptions {
  startPage: number; // Trang bắt đầu, đánh số từ 1.
  endPage: number;
  offset?: number;
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 20_000; // Cùng giới hạn mặc định với epub-parser.

/**
 * Lấy văn bản trong khoảng trang, thêm mốc `[p.N]` giữa các trang để model
 * có thể dẫn trang và gọi readPage. Sau đó cắt theo offset ký tự.
 * Offset ở đây tính trong chương (gồm mốc trang), khác offset trong một trang của annotation.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  opts: PdfReadOptions,
): Promise<ChapterTextSlice> {
  const { startPage, endPage, offset = 0, maxChars = DEFAULT_MAX_CHARS } = opts;
  const doc = await openPdf(bytes);
  try {
    const parts: string[] = [];
    const last = Math.min(endPage, doc.numPages);
    for (let p = Math.max(1, startPage); p <= last; p++) {
      const text = (await pageText(doc, p)).replace(/\s+/g, " ").trim();
      parts.push(`[p.${p}]`);
      if (text) parts.push(text);
    }
    const full = parts.join("\n\n");
    // Giới hạn offset trong nội dung để nextOffset không vượt full.length,
    // tránh vòng lặp trả mãi đoạn rỗng khi bên gọi lưu vị trí tiếp tục.
    const start = Math.min(offset, full.length);
    const text = full.slice(start, start + maxChars);
    const nextOffset = start + text.length;
    return { text, hasMore: nextOffset < full.length, nextOffset };
  } finally {
    await doc.cleanup();
    await doc.loadingTask.destroy();
  }
}
