import type { SetPreferenceInput } from "@shared/preferences";

/**
 * Lưu một tùy chọn bất đồng bộ vào DB của main process mà không chờ kết quả;
 * lỗi lưu không làm gián đoạn UI. Bỏ qua nếu không có preload hoặc window trong kiểm thử.
 * Module không import store để tránh phụ thuộc vòng.
 */
export function persistPreference(input: SetPreferenceInput): void {
  if (typeof window === "undefined" || !window.api?.preferences) return;
  void window.api.preferences.set(input).catch(() => {});
}
