import type { ReaderFontFamily } from "@renderer/types";

/**
 * Bộ phông nội dung ngoài mức default: phông Latin trước, phông chữ Hán đi kèm làm dự phòng,
 * cuối cùng là phông hệ thống. Văn Khải có glyph Latin riêng nên không ghép với phông Latin khác.
 */
export const FONT_STACKS: Record<Exclude<ReaderFontFamily, "default">, string> = {
  wenkai: `"LXGW WenKai", "Songti SC", serif`,
  serif: `"Fraunces Variable", "Noto Serif SC", Georgia, serif`,
  sans: `"Manrope Variable", "Noto Sans SC", system-ui, sans-serif`,
};

/** Bộ phông monospace cho code/pre khi đổi phông nội dung để giữ bố cục khối mã. */
export const MONO_STACK = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
