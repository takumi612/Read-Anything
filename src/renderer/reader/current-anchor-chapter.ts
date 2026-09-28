export interface AnchorChapterPos {
  id: string;
  anchor: string;
  top: number; // offsetTop của phần tử neo trong section, tính bằng px.
}

/** Chọn chương có neo gần đầu khung nhìn nhất mà không vượt qua; nếu mọi neo ở dưới thì lấy chương đầu. */
export function pickAnchorChapterId(
  chapters: AnchorChapterPos[],
  viewportTop: number,
): string | null {
  if (chapters.length === 0) return null;
  let picked = chapters[0]!.id;
  for (const c of chapters) {
    if (c.top <= viewportTop) picked = c.id;
    else break;
  }
  return picked;
}
