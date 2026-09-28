import { flushSync } from "react-dom";
import { usePrefsStore } from "@renderer/store/prefs-store";

/**
 * Cách focus ô nhập Composer từ các nơi gọi bên ngoài cây ref.
 * use-ai-actions, chat-store và AIPanel dùng registry ở cấp module để gọi hàm focus
 * do Composer đăng ký, tương tự useImperativeHandle.
 */
let focusFn: (() => void) | null = null;

/** Composer đăng ký hàm focus khi gắn và truyền null để hủy khi tháo. */
export function registerComposerFocus(fn: (() => void) | null): void {
  focusFn = fn;
}

/** Focus ô nhập nếu đã đăng ký; chưa đăng ký thì bỏ qua an toàn. */
export function focusComposer(): void {
  focusFn?.();
}

/**
 * Open the right-side assistant, commit its visibility, then focus the composer.
 * The composer stays mounted while hidden, so the focus handle is already registered.
 */
export function openPanelAndFocusComposer(): void {
  flushSync(() => usePrefsStore.getState().updateLayout({ panelOpen: true }));
  focusComposer();
}
