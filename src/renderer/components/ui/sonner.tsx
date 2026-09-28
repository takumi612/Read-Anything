import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useThemeStore } from "@renderer/store/theme-store";

/**
 * Global toast container. Keep notifications near the lower edge so they do not cover reader controls.
 * richColors gán màu theo ý nghĩa cho success, info, warning và error.
 * Gắn một lần ở gốc App, rồi gọi toast() để hiển thị.
 */
export function Toaster(props: ToasterProps) {
  const theme = useThemeStore((s) => s.resolvedTheme);
  return (
    <Sonner
      theme={theme}
      richColors
      position="bottom-right"
      className="toaster group font-sans"
      {...props}
    />
  );
}
