import type { ChapterRefDto } from "@shared/library";

function stripFragment(href: string): string {
  return href.split("#")[0]!.split("?")[0]!;
}

/** Lấy tên tệp cuối để ghép dự phòng khi tiền tố đường dẫn khác nhau. */
export function basename(href: string): string {
  const p = stripFragment(href);
  return p.slice(p.lastIndexOf("/") + 1);
}

/**
 * Tìm các chương khớp href: ưu tiên khớp chính xác sau khi bỏ fragment,
 * nếu không có thì ghép theo tên tệp. Nhiều chương có thể chung href và khác neo;
 * bên gọi sẽ phân biệt tiếp theo neo.
 */
export function chaptersMatchingHref(chapters: ChapterRefDto[], href: string): ChapterRefDto[] {
  const target = stripFragment(href);
  const exact = chapters.filter((c) => stripFragment(c.href) === target);
  if (exact.length > 0) return exact;
  const base = basename(href);
  return chapters.filter((c) => basename(c.href) === base);
}

/** Đổi href của mục spine thành id chương duy nhất; trả null nếu mơ hồ hoặc không khớp. */
export function chapterIdByHref(chapters: ChapterRefDto[], href: string): string | null {
  const m = chaptersMatchingHref(chapters, href);
  return m.length === 1 ? m[0]!.id : null;
}
