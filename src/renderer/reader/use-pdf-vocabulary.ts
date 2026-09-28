import { useEffect, useState } from "react";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import { rangeFromOffsets, relativeRects, type OverlayRect } from "./pdf-annotations";

export interface VocabularyMark {
  entryId: string;
  term: string;
  meaning: string;
  context: string;
  page: number;
  start: number;
  end: number;
  rect: OverlayRect;
}

/** A selection toolbar owns the active interaction, so do not stack a hover card over it. */
export function shouldShowVocabularyPreview(hasActiveSelection: boolean): boolean {
  return !hasActiveSelection;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match whole words and whitespace-normalized phrases in the actual rendered text layer. */
export function findVocabularyOccurrences(
  pageText: string,
  entries: VocabularyEntryDto[],
  page: number,
): Array<Omit<VocabularyMark, "rect">> {
  const out: Array<Omit<VocabularyMark, "rect">> = [];
  for (const entry of entries) {
    const pattern = entry.normalizedTerm.split(" ").map(escapeRegex).join("\\s+");
    if (!pattern) continue;
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "giu");
    for (const match of pageText.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      const override = entry.overrides.find(
        (candidate) =>
          candidate.page === page && candidate.start === start && candidate.end === end,
      );
      out.push({
        entryId: entry.id,
        term: entry.term,
        meaning: override?.meaning ?? entry.meaning,
        context: entry.context,
        page,
        start,
        end,
      });
    }
  }
  return out;
}

export function usePdfVocabulary(
  entries: VocabularyEntryDto[],
  page: number,
  textLayer: HTMLDivElement | null,
  ready: boolean,
): VocabularyMark[] {
  const [marks, setMarks] = useState<VocabularyMark[]>([]);
  useEffect(() => {
    if (!ready || !textLayer || entries.length === 0) {
      setMarks([]);
      return;
    }
    const base = textLayer.getBoundingClientRect();
    const next: VocabularyMark[] = [];
    for (const occurrence of findVocabularyOccurrences(
      textLayer.textContent ?? "",
      entries,
      page,
    )) {
      const range = rangeFromOffsets(textLayer, occurrence.start, occurrence.end);
      if (!range) continue;
      for (const rect of relativeRects(range.getClientRects(), base)) {
        next.push({ ...occurrence, rect });
      }
    }
    setMarks(next);
  }, [entries, page, textLayer, ready]);
  return marks;
}

export function hitVocabulary(
  marks: VocabularyMark[],
  x: number,
  y: number,
): VocabularyMark | undefined {
  return marks.find(
    (mark) =>
      x >= mark.rect.left &&
      x <= mark.rect.left + mark.rect.width &&
      y >= mark.rect.top &&
      y <= mark.rect.top + mark.rect.height,
  );
}
