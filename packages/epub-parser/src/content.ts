import { strFromU8, unzipSync } from "fflate";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import { readSpine } from "./parse";

export interface ReadOptions {
  offset?: number;
  maxChars?: number;
}
export interface ChapterTextSlice {
  text: string;
  hasMore: boolean;
  nextOffset: number;
}

const DEFAULT_MAX_CHARS = 20_000;

const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption";
const BLOCK_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "blockquote",
  "pre",
  "figcaption",
]);

/** Kiểm tra phần tử có nằm trong khối khác đã được thu thập, để tránh lặp văn bản. */
function isNestedInsideBlock(el: HTMLElement): boolean {
  let node = el.parentNode as HTMLElement | null;
  while (node) {
    if (node.rawTagName && BLOCK_TAGS.has(node.rawTagName.toLowerCase())) return true;
    node = node.parentNode as HTMLElement | null;
  }
  return false;
}

/** Các phần tử khối cấp trên cùng theo thứ tự gốc; bỏ khối lồng nhau. */
function topLevelBlocks(body: HTMLElement): HTMLElement[] {
  return body.querySelectorAll(BLOCK_SELECTOR).filter((b) => !isNestedInsideBlock(b));
}

/** Lấy văn bản khối trong một tệp spine từ anchor đến trước nextAnchor. */
function sliceTextByAnchor(xhtml: string, anchor: string, nextAnchor?: string): string {
  const root = parseHtml(xhtml);
  const body = (root.querySelector("body") ?? root) as HTMLElement;
  const startEl = root.getElementById(anchor);
  if (!startEl) return htmlToText(xhtml); // Không tìm thấy anchor: lấy cả tệp, tránh trả rỗng.
  const startOffset = startEl.range[0];
  const endEl = nextAnchor ? root.getElementById(nextAnchor) : null;
  const endOffset = endEl ? endEl.range[0] : Number.POSITIVE_INFINITY;
  const parts = topLevelBlocks(body)
    .filter((b) => b.range[1] > startOffset && b.range[1] <= endOffset)
    .map((b) => b.text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.join("\n");
}

/**
 * Lấy văn bản khối của một tệp spine trong khoảng từ fromAnchor đến trước toAnchor.
 * Thiếu fromAnchor/toAnchor thì dùng đầu/cuối tệp. Nếu không tìm thấy anchor, cũng dùng
 * đầu/cuối để không làm mất nội dung. Khác sliceTextByAnchor: fromAnchor thiếu thì
 * lấy các khối từ đầu thay vì chuyển cả tệp qua htmlToText.
 */
function sliceFileBlocks(xhtml: string, fromAnchor?: string, toAnchor?: string): string {
  const root = parseHtml(xhtml);
  const body = (root.querySelector("body") ?? root) as HTMLElement;
  const fromEl = fromAnchor ? root.getElementById(fromAnchor) : null;
  const fromOffset = fromEl ? fromEl.range[0] : 0;
  const toEl = toAnchor ? root.getElementById(toAnchor) : null;
  const toOffset = toEl ? toEl.range[0] : Number.POSITIVE_INFINITY;
  return topLevelBlocks(body)
    .filter((b) => b.range[1] > fromOffset && b.range[1] <= toOffset)
    .map((b) => b.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Cắt văn bản chương theo offset/maxChars thành ChapterTextSlice; nextOffset không vượt quá cuối. */
function paginate(full: string, opts: ReadOptions): ChapterTextSlice {
  const offset = Math.max(0, opts.offset ?? 0);
  const maxChars = Math.max(1, opts.maxChars ?? DEFAULT_MAX_CHARS);
  const slice = full.slice(offset, offset + maxChars);
  const nextOffset = Math.min(offset + slice.length, full.length);
  return { text: slice, hasMore: nextOffset < full.length, nextOffset };
}

/** Chuyển XHTML thành văn bản: lấy nội dung các khối, xuống dòng giữa khối và gộp khoảng trắng.
 * Known limitations:
 *   - <pre> whitespace is collapsed (not preserved).
 *   - Char-offset slicing (in extractChapterText) may split a surrogate pair for rare
 *     supplementary-plane chars — acceptable for now.
 */
export function htmlToText(xhtml: string): string {
  const root = parseHtml(xhtml);
  const body = (root.querySelector("body") ?? root) as HTMLElement;

  // Keep only top-level selected blocks; a block's .text already includes nested content.
  const topLevel = topLevelBlocks(body);
  const parts = (topLevel.length ? topLevel.map((b) => b.text) : [body.text])
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.join("\n");
}

/** Lấy văn bản chương theo href từ bytes EPUB rồi phân trang; không truy cập DB hoặc đĩa. */
export function extractChapterText(
  bytes: Uint8Array,
  href: string,
  opts: ReadOptions,
  anchor?: string,
  nextAnchor?: string,
): ChapterTextSlice {
  const files = unzipSync(bytes);
  const entry = files[href];
  if (!entry) throw new Error(`epub: missing entry ${href}`);
  const xhtml = strFromU8(entry);
  const full = anchor ? sliceTextByAnchor(xhtml, anchor, nextAnchor) : htmlToText(xhtml);
  return paginate(full, opts);
}

/**
 * Lấy văn bản của một mục lục, có thể trải qua nhiều tệp spine liên tiếp; không truy cập DB/đĩa.
 *
 * Một mục TOC có thể gồm nhiều tệp spine: một tệp chứa tiêu đề, tệp sau chứa nội dung.
 * Các tệp không có mục TOC riêng ở giữa vẫn thuộc chương này; đọc một href sẽ bỏ sót chúng.
 *
 * Nội dung chương bắt đầu tại start(href, anchor) và kết thúc trước end của mục TOC kế tiếp,
 * ghép theo thứ tự spine. Nếu không có end thì đọc đến hết sách.
 * Tệp đầu: đọc từ start.anchor; tệp giữa: lấy toàn bộ; tệp cuối chỉ lấy đến end.anchor nếu có.
 * Nếu end không có anchor, chương kế tiếp bắt đầu ở đầu tệp đó nên tệp ấy không thuộc chương này.
 * TOC lỗi (start không ở spine hoặc end không hợp lệ): chỉ lấy tệp start để tránh nuốt cả sách.
 */
export function extractChapterAcrossSpine(
  bytes: Uint8Array,
  start: { href: string; anchor?: string },
  end: { href: string; anchor?: string } | undefined,
  opts: ReadOptions,
): ChapterTextSlice {
  const files = unzipSync(bytes);
  const fileText = (href: string): string => {
    const entry = files[href];
    if (!entry) throw new Error(`epub: missing entry ${href}`);
    return strFromU8(entry);
  };
  const spine = readSpine(files).map((s) => s.href);
  const startIdx = spine.indexOf(start.href);
  const endIdx = end ? spine.indexOf(end.href) : spine.length;

  const segments: string[] = [];
  if (startIdx === -1) {
    // start.href không có trong spine: chỉ lấy tệp đó, áp dụng end nếu cùng tệp.
    const sameFileEnd = end && end.href === start.href ? end.anchor : undefined;
    segments.push(sliceFileBlocks(fileText(start.href), start.anchor, sameFileEnd));
  } else if (end && endIdx === startIdx) {
    // Hai anchor trong cùng tệp: lấy từ start đến trước end, gồm cả chương cha và mục con.
    segments.push(sliceFileBlocks(fileText(start.href), start.anchor, end.anchor));
  } else if (!end || endIdx > startIdx) {
    // Khoảng qua nhiều tệp hoặc đọc đến cuối sách.
    const lastExclusive = end ? endIdx : spine.length;
    segments.push(sliceFileBlocks(fileText(start.href), start.anchor, undefined));
    for (let i = startIdx + 1; i < lastExclusive; i++) {
      segments.push(sliceFileBlocks(fileText(spine[i]!), undefined, undefined));
    }
    if (end?.anchor)
      segments.push(sliceFileBlocks(fileText(spine[endIdx]!), undefined, end.anchor));
  } else {
    // end không hợp lệ: chỉ lấy tệp start, không tự đoán ranh giới.
    segments.push(sliceFileBlocks(fileText(start.href), start.anchor, undefined));
  }
  return paginate(segments.filter(Boolean).join("\n"), opts);
}

/**
 * Lấy văn bản toàn sách theo thứ tự href đến maxChars. Chỉ giải nén EPUB một lần;
 * gọi extractChapterText cho từng chương sẽ giải nén N lần và chặn main process.
 * Hàm này không truy cập DB hoặc đĩa.
 */
export function extractBookText(
  bytes: Uint8Array,
  hrefs: string[],
  opts: { maxChars: number },
): { text: string; truncated: boolean } {
  const files = unzipSync(bytes); // Giải nén một lần.
  const parts: string[] = [];
  let used = 0;
  let truncated = false;
  for (const href of hrefs) {
    const remaining = opts.maxChars - used;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const entry = files[href];
    if (!entry) continue; // Bỏ qua tệp có trong spine nhưng thiếu trong ZIP.
    const full = htmlToText(strFromU8(entry));
    const slice = full.slice(0, remaining);
    if (slice.length > 0) {
      parts.push(slice);
      used += slice.length;
    }
    if (slice.length < full.length) {
      truncated = true; // Hết ngân sách ký tự: dừng.
      break;
    }
  }
  return { text: parts.join("\n\n"), truncated };
}
