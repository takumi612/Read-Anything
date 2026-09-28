import type { SelectionInfo } from "@renderer/types";
import { makePdfLocatorRange } from "./pdf-locator";

/** Số ký tự lấy trước và sau vùng chọn làm ngữ cảnh, vì PDF không có DOM theo đoạn văn. */
const CONTEXT_WINDOW = 300;

/** Keep a floating PDF selection active while the reader scrolls inside its dictionary result. */
export function shouldDismissPdfSelectionOnScroll(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return target.closest("[data-selection-lookup-panel]") === null;
}

/** Convert an offset from textContent to innerText when the only differences are whitespace. */
function mapWhitespaceOffset(source: string, target: string, offset: number): number | null {
  if (source === target) return Math.max(0, Math.min(offset, source.length));

  const offsets = Array.from({ length: source.length + 1 }, () => 0);
  let sourceIndex = 0;
  let targetIndex = 0;
  offsets[0] = 0;

  while (sourceIndex < source.length) {
    if (/\s/u.test(source[sourceIndex]!)) {
      const sourceGapStart = sourceIndex;
      const targetGapStart = targetIndex;
      while (sourceIndex < source.length && /\s/u.test(source[sourceIndex]!)) sourceIndex++;
      while (targetIndex < target.length && /\s/u.test(target[targetIndex]!)) targetIndex++;
      for (let index = sourceGapStart; index < sourceIndex; index++) {
        offsets[index] = targetGapStart;
      }
      offsets[sourceIndex] = targetIndex;
      continue;
    }

    while (targetIndex < target.length && /\s/u.test(target[targetIndex]!)) {
      targetIndex++;
      offsets[sourceIndex] = targetIndex;
    }
    if (source[sourceIndex] !== target[targetIndex]) return null;

    offsets[sourceIndex] = targetIndex;
    sourceIndex++;
    targetIndex++;
    offsets[sourceIndex] = targetIndex;
  }

  while (targetIndex < target.length && /\s/u.test(target[targetIndex]!)) targetIndex++;
  if (targetIndex !== target.length) return null;
  offsets[source.length] = targetIndex;
  return offsets[Math.max(0, Math.min(offset, source.length))] ?? null;
}

/**
 * Tính vị trí của (node, offsetInNode) trong luồng văn bản phẳng của root.
 * Nối các text node theo thứ tự tài liệu như các span của textLayer, không thêm dấu xuống dòng
 * EOL do PDF.js tổng hợp. pdf-locator range và hình tô sáng dùng cùng hệ tọa độ.
 * Nếu node nằm ngoài root hoặc không phải text node thì trả null. Bên gọi đặt locatorRange=null;
 * vẫn hỏi AI được nhưng không neo chú thích vào vùng chọn đó.
 */
export function flatOffsetOf(root: Node, node: Node, offsetInNode: number): number | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  let acc = 0;
  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (t === node) return acc + offsetInNode;
    acc += (t.textContent ?? "").length;
  }
  return null;
}

/**
 * Kiểm tra tọa độ (clientX, clientY) có nằm trong vùng chọn DOM đang mở hay không.
 * caretRangeFromPoint cùng isPointInRange kiểm tra tới ký tự, kể cả mép vùng chọn qua nhiều dòng.
 * Tương tự pointInSelection của SectionFrame nhưng áp dụng cho tài liệu chính.
 * Dùng để giữ vùng chọn khi nhấn vào nó và đổi con trỏ khi rê chuột.
 */
export function pointInDomSelection(x: number, y: number): boolean {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  try {
    const caret = (
      document as Document & { caretRangeFromPoint?(x: number, y: number): Range | null }
    ).caretRangeFromPoint?.(x, y);
    return !!caret && sel.getRangeAt(0).isPointInRange(caret.startContainer, caret.startOffset);
  } catch {
    return false;
  }
}

export interface PdfSelectionArgs {
  page: number; // 1-based
  /** Văn bản phẳng của textLayer trang này từ element.textContent. */
  pageStr: string;
  /** Văn bản hiển thị từ element.innerText, gồm các chỗ xuống dòng theo bố cục PDF.js. */
  contextPageStr?: string;
  /** Vị trí trong trang; null khi vùng chọn qua nhiều trang hoặc trên phần tử chứa. */
  start: number | null;
  end: number | null;
  selectionText: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** Tạo SelectionInfo của PDF, dùng ký tự trước và sau vùng chọn làm ngữ cảnh thay cho đoạn văn. */
export function buildPdfSelectionInfo(a: PdfSelectionArgs): SelectionInfo {
  const s = a.start ?? 0;
  const e = a.end ?? Math.min(s + a.selectionText.length, a.pageStr.length);
  const mappedStart =
    a.start == null ? null : mapWhitespaceOffset(a.pageStr, a.contextPageStr ?? a.pageStr, s);
  const mappedEnd =
    a.end == null ? null : mapWhitespaceOffset(a.pageStr, a.contextPageStr ?? a.pageStr, e);
  const useLayoutText = mappedStart != null && mappedEnd != null;
  const contextPageStr = useLayoutText ? (a.contextPageStr ?? a.pageStr) : a.pageStr;
  const contextStart = useLayoutText ? mappedStart : s;
  const contextEnd = useLayoutText ? mappedEnd : e;
  const windowText = contextPageStr
    .slice(
      Math.max(0, contextStart - CONTEXT_WINDOW),
      Math.min(contextPageStr.length, contextEnd + CONTEXT_WINDOW),
    )
    .trim();
  return {
    selectionText: a.selectionText,
    paragraphBefore: null,
    paragraphCurrent: windowText.length > 0 ? windowText : a.selectionText,
    paragraphAfter: null,
    rect: a.rect,
    locatorRange:
      a.start != null && a.end != null && a.end > a.start
        ? makePdfLocatorRange({ page: a.page, start: a.start, end: a.end })
        : null,
  };
}
