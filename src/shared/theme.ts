import type { ColorMode } from "@shared/preferences";

/** Theme thực tế sau khi xử lý lựa chọn theo hệ thống. */
export type ResolvedTheme = "light" | "dark";

/** Chuyển colorMode và tùy chọn tối của hệ thống thành light/dark, không phụ thuộc DOM. */
export function resolveTheme(mode: ColorMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}
