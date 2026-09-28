import type { AnnotationDto, AnnotationStyle } from "@shared/annotations";
import { parsePdfLocatorRange } from "./pdf-locator";
import { hasNote } from "./highlight";

/** Dữ liệu vẽ chú thích trên một trang: vị trí từ locatorRange và thuộc tính hiển thị. */
export interface PdfPageAnno {
  id: string;
  style: AnnotationStyle;
  hasNote: boolean;
  start: number;
  end: number;
}

/**
 * Đổi khoảng vị trí phẳng thành DOM Range trong root, ngược với flatOffsetOf.
 * Các text node của textLayer được nối theo thứ tự tài liệu như mô tả trong pdf-selection.ts.
 * Vị trí ngoài phạm vi hoặc khoảng rỗng trả null để bên gọi bỏ qua việc vẽ.
 * Bản v1 chưa neo lại từ selectedText khi kết quả trích xuất văn bản thay đổi.
 */
export function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  if (start < 0 || end <= start) return null;
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startNode: Node | null = null;
  let startOffset = 0;
  let endNode: Node | null = null;
  let endOffset = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const len = (t.textContent ?? "").length;
    if (startNode === null && acc + len > start) {
      startNode = t;
      startOffset = start - acc;
    }
    if (acc + len >= end) {
      endNode = t;
      endOffset = end - acc;
      break;
    }
    acc += len;
  }
  if (!startNode || !endNode) return null;
  const range = doc.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

/** Nhóm chú thích theo trang để vẽ; bỏ qua locator không phải PDF hoặc không phân tích được. */
export function pdfAnnosByPage(annos: AnnotationDto[]): Map<number, PdfPageAnno[]> {
  const map = new Map<number, PdfPageAnno[]>();
  for (const a of annos) {
    const r = parsePdfLocatorRange(a.locatorRange);
    if (!r) continue;
    const arr = map.get(r.page) ?? [];
    arr.push({
      id: a.id,
      style: a.style,
      hasNote: hasNote(a.note),
      start: r.start,
      end: r.end,
    });
    map.set(r.page, arr);
  }
  return map;
}

/** Khóa sắp xếp chú thích PDF theo trang rồi vị trí trong trang; locator khác PDF trả null để dùng đường CFI. */
export function pdfOrderKey(locator: string): number | null {
  const r = parsePdfLocatorRange(locator);
  return r ? r.page * 1_000_000 + Math.min(r.start, 999_999) : null;
}

/** Hình chữ nhật lớp phủ theo tọa độ tương đối với khung. */
export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Đổi tọa độ khung nhìn sang tọa độ khung chứa; bỏ mảnh dưới 1px do getClientRects tạo ở chỗ xuống dòng. */
export function relativeRects(
  rects: Iterable<{ x: number; y: number; width: number; height: number }>,
  container: { x: number; y: number },
): OverlayRect[] {
  const out: OverlayRect[] = [];
  for (const r of rects) {
    if (r.width < 1 || r.height < 1) continue;
    out.push({ left: r.x - container.x, top: r.y - container.y, width: r.width, height: r.height });
  }
  return out;
}
