// Phân tích liên kết [[slug]] trong body; bảng cạnh chỉ là chỉ mục suy ra.
// slug là tên tiếng Anh dạng kebab-case theo shared/memory.ts.
const LINK_RE = /\[\[([a-z0-9]+(?:-[a-z0-9]+)*)\]\]/g;

/** Lấy [[slug]] theo thứ tự xuất hiện, bỏ trùng và bỏ tên sai dạng. */
export function extractLinks(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(LINK_RE)) {
    seen.add(m[1]);
  }
  return [...seen];
}
