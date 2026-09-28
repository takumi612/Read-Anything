import type { ReaderPrefs } from "../types";
import { FONT_STACKS, MONO_STACK } from "./font-stacks";

/**
 * Chuyển tùy chọn đọc thành CSS chèn vào iframe của từng section: cỡ chữ, giãn dòng,
 * chiều rộng nội dung và phông chữ.
 *
 * CSS được chèn trước style của ePub. Sách thường đặt line-height, margin và font-family
 * trực tiếp trên p hoặc div, nên tùy chọn người dùng cần !important để ghi đè.
 * line-height phải áp dụng trực tiếp lên khối nội dung; không áp dụng lên tiêu đề để giữ bố cục gọn.
 * font-size đặt theo phần trăm trên html để rem/em kế thừa, thường không cần !important.
 * Muốn đổi phông phải áp dụng body *, rồi đặt lại phông monospace cho code/pre bằng selector cụ thể hơn.
 * Mức default không tạo quy tắc font-family để giữ phông gốc của sách.
 */
export function prefsToCss(prefs: ReaderPrefs): string {
  const fontPct = Math.round(prefs.fontScale * 100);
  const rules = [
    `html { font-size: ${fontPct}%; }`,
    `body {`,
    `  max-width: ${prefs.maxWidth}px !important;`,
    `  margin: 0 auto !important;`,
    `  padding: 1rem !important;`,
    `}`,
    `body p, body div, body li, body blockquote, body dd, body dt, body td, body th {`,
    `  line-height: ${prefs.lineHeight} !important;`,
    `}`,
    `img { max-width: 100%; height: auto; }`,
  ];
  if (prefs.fontFamily !== "default") {
    rules.push(
      `body, body * { font-family: ${FONT_STACKS[prefs.fontFamily]} !important; }`,
      `body :is(code, pre, samp, kbd), body :is(code, pre) * { font-family: ${MONO_STACK} !important; }`,
    );
  }
  return rules.join("\n");
}
