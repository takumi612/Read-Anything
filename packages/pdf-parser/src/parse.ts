import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ChapterRange, ParsedPdf, TocNode } from "./types";

// Tài nguyên pdfjs đọc qua fs; Electron cũng đọc được tệp trong asar.
// cmaps giải mã font CID, cần cho một số sách CJK để text layer không thành chữ lỗi.
// Main bundle là CJS có require nhưng không có import.meta.url; Vitest chạy source ESM
// có import.meta.url nhưng không có require toàn cục. Đường dẫn cần hỗ trợ cả hai.
const requireFn = typeof require !== "undefined" ? require : createRequire(import.meta.url);
const PDFJS_ROOT = path.dirname(requireFn.resolve("pdfjs-dist/package.json"));
const CMAP_URL = pathToFileURL(path.join(PDFJS_ROOT, "cmaps") + path.sep).href;
const STANDARD_FONT_DATA_URL = pathToFileURL(path.join(PDFJS_ROOT, "standard_fonts") + path.sep).href;

/** Nếu số ký tự trung bình trên trang mẫu dưới ngưỡng này thì coi là PDF scan. */
const TEXT_LAYER_MIN_AVG_CHARS = 50;
const TEXT_LAYER_SAMPLE_PAGES = 8;

/**
 * Mở PDF bằng pdfjs; luôn truyền bản sao vì pdfjs có thể chuyển quyền sở hữu buffer.
 */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  try {
    return await task.promise;
  } catch (err) {
    // Promise lỗi không tự dọn task/worker, cần destroy tường minh.
    await task.destroy();
    throw err;
  }
}

/** Ghép items.str thành văn bản trang và xuống dòng khi hasEOL. */
export async function pageText(doc: PDFDocumentProxy, pageNo: number): Promise<string> {
  const page = await doc.getPage(pageNo);
  const tc = await page.getTextContent();
  let out = "";
  for (const item of tc.items) {
    if ("str" in item) {
      out += item.str;
      if (item.hasEOL) out += "\n";
    }
  }
  page.cleanup();
  return out;
}

interface FlatOutlineEntry {
  title: string;
  pageIndex: number; // 0-based
}

/** Trải phẳng TOC và chuyển destination thành số trang, kể cả destination theo tên. */
async function flattenOutline(doc: PDFDocumentProxy): Promise<FlatOutlineEntry[]> {
  const outline = await doc.getOutline();
  if (!outline || outline.length === 0) return [];
  const flat: FlatOutlineEntry[] = [];
  type OutlineItem = (typeof outline)[number];
  const walk = async (items: OutlineItem[]): Promise<void> => {
    for (const item of items) {
      const explicit =
        typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      const ref = explicit?.[0];
      if (ref != null) {
        try {
          const pageIndex = await doc.getPageIndex(ref);
          const title = item.title?.trim();
          if (title) flat.push({ title, pageIndex });
        } catch {
          // Destination trỏ tới trang không tồn tại: bỏ mục này, vẫn import sách.
        }
      }
      if (item.items?.length) await walk(item.items);
    }
  };
  await walk(outline);
  // Sắp mục TOC theo trang bắt đầu nếu nguồn đưa thứ tự không đúng.
  flat.sort((a, b) => a.pageIndex - b.pageIndex);
  return flat;
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  const doc = await openPdf(bytes);
  try {
    const pageCount = doc.numPages;

    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: string; Author?: string };
    const title = info.Title?.trim() || undefined;
    const author = info.Author?.trim() || undefined;

    // Phát hiện PDF scan từ số ký tự trung bình của N trang đầu.
    const sample = Math.min(TEXT_LAYER_SAMPLE_PAGES, pageCount);
    let chars = 0;
    for (let p = 1; p <= sample; p++) chars += (await pageText(doc, p)).length;
    const hasTextLayer = sample > 0 && chars / sample >= TEXT_LAYER_MIN_AVG_CHARS;

    const flat = await flattenOutline(doc);
    let toc: TocNode[];
    let chapterRanges: ChapterRange[];
    if (flat.length > 0) {
      toc = flat.map((e, i) => ({ label: e.title, href: `pdf-ch:${i}` }));
      chapterRanges = flat.map((e, i) => ({
        startPage: e.pageIndex + 1,
        // Chương kết thúc ngay trước trang bắt đầu của chương kế; chương cuối đến hết sách.
        // Nếu hai chương bắt đầu cùng trang, Math.max giữ ít nhất một trang cho chương trước.
        endPage:
          i + 1 < flat.length ? Math.max(e.pageIndex + 1, flat[i + 1]!.pageIndex) : pageCount,
      }));
    } else {
      toc = [];
      chapterRanges = [{ startPage: 1, endPage: pageCount }];
    }

    return { title, author, pageCount, toc, chapterRanges, hasTextLayer };
  } finally {
    await doc.cleanup();
    await doc.loadingTask.destroy();
  }
}
