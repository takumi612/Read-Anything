// Lấy chuỗi CSS @font-face đã chia phần từ @fontsource qua ?inline để chèn vào iframe section.
// Iframe là tài liệu riêng nên không thấy @font-face của tài liệu chính; phải đưa vào styleCss.
// Chỉ ghép mức phông đang chọn vì CSS cho chữ Hán khoảng 100 KB mỗi độ đậm, mỗi iframe giữ một bản.
// unicode-range giúp trình duyệt chỉ tải woff2 chứa ký tự thực sự dùng.
import frauncesItalic from "@fontsource-variable/fraunces/wght-italic.css?inline";
import frauncesWght from "@fontsource-variable/fraunces/wght.css?inline";
import manropeWght from "@fontsource-variable/manrope/wght.css?inline";
import notoSansSc400 from "@fontsource/noto-sans-sc/400.css?inline";
import notoSansSc700 from "@fontsource/noto-sans-sc/700.css?inline";
import notoSerifSc400 from "@fontsource/noto-serif-sc/400.css?inline";
import notoSerifSc700 from "@fontsource/noto-serif-sc/700.css?inline";
import wenkaiBold from "lxgw-wenkai-webfont/lxgwwenkai-bold.css?inline";
import wenkaiRegular from "lxgw-wenkai-webfont/lxgwwenkai-regular.css?inline";
import type { ReaderFontFamily } from "@renderer/types";

const FONT_FACE_CSS: Record<Exclude<ReaderFontFamily, "default">, string> = {
  wenkai: [wenkaiRegular, wenkaiBold].join("\n"),
  // Nội dung thường có <em>; mức serif thêm biến thể nghiêng Fraunces, chữ Hán để trình duyệt tự tổng hợp.
  serif: [frauncesWght, frauncesItalic, notoSerifSc400, notoSerifSc700].join("\n"),
  sans: [manropeWght, notoSansSc400, notoSansSc700].join("\n"),
};

/** CSS @font-face cần chèn vào iframe cho mức phông hiện tại; default trả chuỗi rỗng. */
export function fontFaceCss(fontFamily: ReaderFontFamily): string {
  return fontFamily === "default" ? "" : FONT_FACE_CSS[fontFamily];
}
