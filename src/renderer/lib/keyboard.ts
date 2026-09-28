import type { KeyboardEvent } from "react";

/** Các trường isSubmitEnter thực sự đọc, tương thích React.KeyboardEvent để dễ tạo dữ liệu kiểm thử. */
type SubmitKeyEvent = Pick<KeyboardEvent, "key" | "shiftKey"> & {
  readonly nativeEvent: { readonly isComposing: boolean };
};

/**
 * Chỉ gửi khi nhấn Enter không kèm Shift và không đang nhập qua IME; hàm thuần có thể kiểm thử.
 *
 * Trong IME Đông Á, Enter có thể xác nhận từ đang gõ và nativeEvent.isComposing là true.
 * Gửi lúc này sẽ gửi nhầm phần chữ chưa hoàn chỉnh. Chat và form một dòng cùng dùng bộ lọc này.
 */
export function isSubmitEnter(e: SubmitKeyEvent): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing;
}
