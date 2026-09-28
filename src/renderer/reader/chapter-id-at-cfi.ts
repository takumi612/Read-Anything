import { EpubCFI } from "epubjs";
import type { ChapterRefDto } from "@shared/library";
import { chaptersMatchingHref } from "./chapter-id-by-href";

/** Ranh giới chương chung href là CFI của phần tử neo đầu chương; anchorBoundaries sắp tăng theo CFI. */
export interface AnchorBoundary {
  chapterId: string;
  cfi: string;
}

/**
 * Đổi CFI của chú thích hoặc vị trí ePub thành id chương, tương tự chapterIdAtPage của PDF.
 * Nếu href chỉ có một chương thì trả ngay; nếu chung href thì so CFI với anchorBoundaries.
 * Trả null khi chưa có ranh giới để tránh hiện sai chương.
 */
export function chapterIdAtCfi(
  chapters: ChapterRefDto[],
  spineHrefs: string[],
  cfi: string,
  anchorBoundaries: AnchorBoundary[] = [],
): string | null {
  let pos: number;
  try {
    pos = new EpubCFI(cfi).spinePos ?? -1;
  } catch {
    return null;
  }
  const href = pos >= 0 ? spineHrefs[pos] : undefined;
  if (!href) return null;

  const matches = chaptersMatchingHref(chapters, href);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!.id;

  // Chương chung href được phân biệt tiếp theo điểm neo.
  const ids = new Set(matches.map((c) => c.id));
  const relevant = anchorBoundaries.filter((b) => ids.has(b.chapterId));
  if (relevant.length === 0) return null;

  const epub = new EpubCFI();
  let picked: string | null = null;
  for (const b of relevant) {
    if (epub.compare(b.cfi, cfi) <= 0) picked = b.chapterId;
    else break;
  }
  return picked;
}
