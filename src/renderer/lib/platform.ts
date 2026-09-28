/** Kiểm tra macOS qua user agent; navigator luôn có trong renderer. */
export const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

/** Ký hiệu phím bổ trợ chính trong phím tắt: macOS dùng ⌘, nền tảng khác dùng Ctrl. */
export const modKeyLabel = isMac ? "⌘" : "Ctrl";
