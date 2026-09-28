export type LinkTarget =
  | { type: "external"; url: string }
  | { type: "internal"; href: string }
  | null;

const EXTERNAL = /^(https?:|mailto:)/i;

/** Phân loại <a href> trong iframe: URL tuyệt đối http/https/mailto là liên kết ngoài; đường dẫn tương đối/#fragment là nội bộ; href trống hoặc chỉ "#" thì bỏ qua. */
export function classifyLink(href: string): LinkTarget {
  const h = href.trim();
  if (!h || h === "#") return null;
  if (EXTERNAL.test(h)) return { type: "external", url: h };
  return { type: "internal", href: h };
}
