import type { ChapterRefDto } from "@shared/library";

/**
 * Trang thuộc chương cuối có startPage không lớn hơn page, khi chapters đã sắp theo orderIndex.
 * Nếu nhiều chương bắt đầu cùng trang thì chọn chương sau, như tiêu đề gần nhất.
 * Trả null khi trang trước chương đầu hoặc thiếu dữ liệu trang.
 */
export function chapterIdAtPage(chapters: ChapterRefDto[], page: number): string | null {
  let hit: string | null = null;
  for (const c of chapters) {
    if (c.startPage != null && c.startPage <= page) hit = c.id;
  }
  return hit;
}
