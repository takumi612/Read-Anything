import { useEffect, useState } from "react";
import type { AnnotationStyle } from "@shared/annotations";
import {
  rangeFromOffsets,
  relativeRects,
  type OverlayRect,
  type PdfPageAnno,
} from "./pdf-annotations";

/** Một hình chữ nhật có thể vẽ; chú thích qua nhiều dòng tạo nhiều hình chung annoId. */
export interface HighlightRect {
  annoId: string;
  style: AnnotationStyle;
  hasNote: boolean;
  rect: OverlayRect;
}

/** Tìm hình tô sáng chứa điểm (x,y) theo khung trang, dùng cho nhấn sửa và con trỏ khi rê. */
export function hitHighlight(
  highlights: HighlightRect[],
  x: number,
  y: number,
): HighlightRect | undefined {
  return highlights.find(
    (h) =>
      x >= h.rect.left &&
      x <= h.rect.left + h.rect.width &&
      y >= h.rect.top &&
      y <= h.rect.top + h.rect.height,
  );
}

/**
 * Sau khi textLayer vẽ xong, đổi vị trí ký tự của từng chú thích thành các hình chữ nhật
 * theo khung trang bằng Range.getClientRects(). Bỏ qua vị trí ngoài phạm vi;
 * bản v1 chưa neo lại theo selectedText. Khi zoom đổi, hình được tính lại theo bố cục mới.
 */
export function usePdfHighlights(
  annos: PdfPageAnno[],
  textLayer: HTMLDivElement | null,
  ready: boolean,
): HighlightRect[] {
  const [rects, setRects] = useState<HighlightRect[]>([]);
  useEffect(() => {
    if (!ready || !textLayer || annos.length === 0) {
      setRects([]);
      return;
    }
    const containerRect = textLayer.getBoundingClientRect();
    const out: HighlightRect[] = [];
    for (const a of annos) {
      const range = rangeFromOffsets(textLayer, a.start, a.end);
      if (!range) continue;
      for (const rect of relativeRects(range.getClientRects(), containerRect)) {
        out.push({ annoId: a.id, style: a.style, hasNote: a.hasNote, rect });
      }
    }
    setRects(out);
  }, [annos, textLayer, ready]);
  return rects;
}
