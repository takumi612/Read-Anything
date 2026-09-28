import { create } from "zustand";
import type { ColorMode } from "@shared/preferences";
import { resolveTheme, type ResolvedTheme } from "@shared/theme";
import { persistPreference } from "@renderer/store/persist-preference";

/** Đọc tùy chọn nền tối của hệ điều hành qua matchMedia; thiếu window thì trả false. */
function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

/** Giá trị ban đầu lấy từ snapshot mà preload đã cache đồng bộ qua preferences.getAll(). */
function initialColorMode(): ColorMode {
  if (typeof window === "undefined") return "system";
  return window.api?.preferences?.getAll?.()?.colorMode ?? "system";
}

interface ThemeState {
  /** Lựa chọn của người dùng, được lưu bền. */
  colorMode: ColorMode;
  /** Chủ đề đang áp dụng; system được phân giải qua matchMedia. */
  resolvedTheme: ResolvedTheme;
  /** OS preference remains available when the app appearance has an explicit light/dark override. */
  systemTheme: ResolvedTheme;
  setColorMode: (mode: ColorMode) => void;
  /** Tính lại theo colorMode khi giao diện hệ điều hành đổi; chỉ ảnh hưởng mức system. */
  syncSystem: () => void;
}

const initMode = initialColorMode();
const initialSystemTheme: ResolvedTheme = prefersDark() ? "dark" : "light";

export const useThemeStore = create<ThemeState>()((set, get) => ({
  colorMode: initMode,
  resolvedTheme: resolveTheme(initMode, initialSystemTheme === "dark"),
  systemTheme: initialSystemTheme,
  setColorMode: (colorMode) => {
    persistPreference({ key: "colorMode", value: colorMode });
    const systemTheme: ResolvedTheme = prefersDark() ? "dark" : "light";
    set({ colorMode, systemTheme, resolvedTheme: resolveTheme(colorMode, systemTheme === "dark") });
  },
  syncSystem: () => {
    const systemTheme: ResolvedTheme = prefersDark() ? "dark" : "light";
    set({ systemTheme, resolvedTheme: resolveTheme(get().colorMode, systemTheme === "dark") });
  },
}));
