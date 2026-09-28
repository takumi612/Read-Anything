export type PresetId = "explain" | "translate" | "summarize";

/**
 * Quyết định cách xử lý bản nháp Composer khi kích hoạt hành động AI, không phụ thuộc i18n.
 * Có preset giải thích, dịch hoặc tóm tắt thì thay bản nháp bằng prompt đã chọn.
 * Không có preset thì trả null để giữ nguyên chữ người dùng đã nhập.
 *
 * @param resolvePrompt Hàm lấy prompt preset do hook bên gọi cung cấp vì cần i18n.
 */
export function presetDraftText(
  preset: PresetId | null,
  resolvePrompt: (preset: PresetId) => string,
): string | null {
  return preset ? resolvePrompt(preset) : null;
}
