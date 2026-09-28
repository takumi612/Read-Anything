import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import type { EpubDropHandlers } from "./use-epub-drop";

/**
 * Lớp phủ thả tệp với nền tối và thẻ viền nét đứt ở giữa.
 * active bật khi con trỏ trên thẻ. zoneHandlers gắn vào thẻ để chỉ thả trúng thẻ mới nhập.
 * Khung phủ toàn viewport và là con DOM của thư viện; sự kiện kéo nổi bọt tới rootHandlers.
 */
export function DropOverlay({
  active,
  zoneHandlers,
}: {
  active: boolean;
  zoneHandlers: EpubDropHandlers;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-10 font-sans">
      <div
        {...zoneHandlers}
        className={cn(
          "flex min-h-[55vh] w-full max-w-2xl flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed text-center transition",
          active
            ? "scale-[1.02] border-primary bg-primary/10 text-primary ring-4 ring-primary/25"
            : "border-muted-foreground/40 bg-popover/60 text-muted-foreground",
        )}
      >
        <Download className="size-14" />
        <p className="text-xl font-medium">
          {active
            ? t("library.dropActive", "Thả để nhập")
            : t("library.dropHint", "Thả tệp ePub hoặc PDF vào đây để nhập")}
        </p>
        <p className="text-sm opacity-70">
          {t("library.dropSubhint", "Có thể thả nhiều tệp cùng lúc; tệp không hỗ trợ sẽ bị bỏ qua")}
        </p>
      </div>
    </div>
  );
}
