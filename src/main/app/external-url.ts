const ALLOWED = new Set(["http:", "https:", "mailto:"]);

/** Chỉ mở liên kết http/https/mailto; chặn các scheme khác trước khi gọi shell.openExternal. */
export function isAllowedExternalUrl(url: string): boolean {
  if (url === "ms-settings:defaultapps") return true;
  try {
    return ALLOWED.has(new URL(url).protocol);
  } catch {
    return false; // URL không hợp lệ.
  }
}
