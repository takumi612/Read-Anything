import { useEffect } from "react";
import { useThemeStore } from "@renderer/store/theme-store";

/**
 * Đồng bộ resolvedTheme với class .dark trên html sau frame đầu do renderer thiết lập.
 * Theo dõi thay đổi giao diện hệ điều hành để cập nhật chủ đề ứng dụng và màu trang PDF.
 * Component không hiển thị gì.
 */
export function ThemeController() {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const syncSystem = useThemeStore((s) => s.syncSystem);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => syncSystem();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [syncSystem]);

  return null;
}
