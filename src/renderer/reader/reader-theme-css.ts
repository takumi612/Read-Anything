import type { ReaderColorMode } from "@shared/preferences";
import type { ResolvedTheme } from "@shared/theme";

/**
 * CSS trang sách tối được VirtualDocs chèn vào iframe trước style của ePub.
 * Chế độ sáng trả chuỗi rỗng để giữ giấy gốc. Màu dùng mã hex vì iframe không thấy biến CSS của tài liệu cha.
 * Nền tối dịu; :where(...) có độ ưu tiên 0 và !important để ghi đè màu tối đặt trực tiếp.
 * Sách có màu hardcoded với !important vẫn có thể thắng vì style của sách được chèn sau.
 */
export function readerThemeCss(mode: ReaderColorMode | boolean): string {
  const theme = typeof mode === "boolean" ? (mode ? "dark" : "light") : mode;
  if (theme === "light" || theme === "system") return "";

  const colors = {
    paper: { background: "#fffaf0", foreground: "#29261f", link: "#456777" },
    sepia: { background: "#efe5ce", foreground: "#3a3227", link: "#315f71" },
    sage: { background: "#e7efe8", foreground: "#29382e", link: "#2d6671" },
    dark: { background: "#15181c", foreground: "#c9cdd1", link: "#6cb6d9" },
  } as const;
  const { background, foreground, link } = colors[theme];
  return [
    `html, body { background-color: ${background} !important; }`,
    `body { color: ${foreground} !important; }`,
    `body :where(p,li,dd,dt,blockquote,span,div,h1,h2,h3,h4,h5,h6,td,th,figcaption) { color: inherit !important; }`,
    `a { color: ${link} !important; }`,
    ...(theme === "dark" ? [`img { filter: brightness(0.9); }`] : []),
  ].join("\n");
}

/** Resolve EPUB page styling from its own preference and the OS theme, never the app chrome theme. */
export function readerThemeCssForMode(mode: ReaderColorMode, systemTheme: ResolvedTheme): string {
  if (mode === "system") return readerThemeCss(systemTheme === "dark");
  return readerThemeCss(mode);
}
