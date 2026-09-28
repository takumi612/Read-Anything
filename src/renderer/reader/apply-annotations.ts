import type { AnnotationDto, AnnotationStyle } from "@shared/annotations";
import type { EpubBook } from "./epub-book";
import { hasNote } from "./highlight";
import { annotationColorHex } from "./annotation-colors";

/** Xóa mọi mark tô sáng: thay bằng nội dung chữ rồi gộp các text node kề nhau. */
export function clearAnnoMarks(doc: Document): void {
  const marks = Array.from(doc.querySelectorAll("mark.anno"));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

/** Bọc từng phần của Range bằng <mark>, kể cả khi Range qua nhiều text node. */
function wrapRange(
  range: Range,
  doc: Document,
  className: string,
  annoId: string,
  style: AnnotationStyle,
): void {
  const root = range.commonAncestorContainer;
  const walker = doc.createTreeWalker(
    root.nodeType === Node.ELEMENT_NODE
      ? root
      : (root.parentNode ?? doc.body ?? doc.documentElement),
    NodeFilter.SHOW_TEXT,
  );
  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    const t = n as Text;
    if (range.intersectsNode(t) && (t.textContent ?? "").length > 0) textNodes.push(t);
    n = walker.nextNode();
  }
  for (const textNode of textNodes) {
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end =
      textNode === range.endContainer ? range.endOffset : (textNode.textContent ?? "").length;
    if (end <= start) continue;
    const sub = doc.createRange();
    sub.setStart(textNode, start);
    sub.setEnd(textNode, end);
    const mark = doc.createElement("mark");
    mark.className = className;
    mark.setAttribute("data-anno-id", annoId);
    if (style.startsWith("#")) mark.style.setProperty("--anno-custom-color", annotationColorHex(style));
    try {
      sub.surroundContents(mark); // Range con trong một text node có thể bọc an toàn.
    } catch {
      /* Bỏ qua đoạn có cấu trúc bất thường. */
    }
  }
}

/**
 * Vẽ chú thích thuộc section thứ index thành mark tô sáng. Xóa mark cũ trước để gọi lại an toàn,
 * lọc bằng book.indexOfCfi rồi lấy Range qua book.rangeFromCfi để bọc.
 * Bỏ qua chú thích có CFI không còn hợp lệ; nó vẫn hiện trong danh sách bên từ dữ liệu đã lưu.
 */
export function applyAnnotations(
  book: EpubBook,
  annotations: AnnotationDto[],
  index: number,
  doc: Document,
): void {
  clearAnnoMarks(doc);
  for (const a of annotations) {
    if (book.indexOfCfi(a.locatorRange) !== index) continue;
    const range = book.rangeFromCfi(a.locatorRange, doc);
    if (!range) continue;
    const noted = hasNote(a.note) ? " anno-noted" : "";
    const styleClass = a.style.startsWith("#") ? "anno-custom" : `anno-${a.style}`;
    wrapRange(range, doc, `anno ${styleClass}${noted}`, a.id, a.style);
  }
}
