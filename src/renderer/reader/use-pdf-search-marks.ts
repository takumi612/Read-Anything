import { useEffect, useState } from "react";
import { rangeFromOffsets, relativeRects, type OverlayRect } from "./pdf-annotations";
import { findPdfTextMatches, type PdfSearchOptions } from "./pdf-search";

export interface PdfSearchMark {
  ordinal: number;
  rect: OverlayRect;
}

export function usePdfSearchMarks(
  textLayer: HTMLDivElement | null,
  ready: boolean,
  query: string,
  options: PdfSearchOptions,
): PdfSearchMark[] {
  const [marks, setMarks] = useState<PdfSearchMark[]>([]);
  useEffect(() => {
    if (!ready || !textLayer || !query.trim()) {
      setMarks([]);
      return;
    }
    const base = textLayer.getBoundingClientRect();
    const next: PdfSearchMark[] = [];
    for (const [ordinal, match] of findPdfTextMatches(
      textLayer.textContent ?? "",
      query,
      options,
    ).entries()) {
      const range = rangeFromOffsets(textLayer, match.start, match.end);
      if (!range) continue;
      for (const rect of relativeRects(range.getClientRects(), base)) {
        next.push({ ordinal, rect });
      }
    }
    setMarks(next);
  }, [textLayer, ready, query, options]);
  return marks;
}
