import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { resolvePdfSurroundingColor } from "./pdf-surrounding-colors";

export function PdfSurroundingColorPicker({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const background = usePrefsStore((state) => state.pdfSurroundingBackground);
  const setBackground = usePrefsStore((state) => state.setPdfSurroundingBackground);
  const setPdfColorMode = usePrefsStore((state) => state.setPdfColorMode);
  const visibleColors = background.colors.filter((color) => color.showInThemeMenu);

  if (visibleColors.length === 0) return null;

  return (
    <section
      className={cn("space-y-2 border-t border-border", compact ? "pt-3" : "pt-4")}
      aria-label={t("settings.pdfCustomSurrounding.title", "Custom PDF background colors")}
    >
      <p className={cn("font-medium", compact ? "px-1 text-xs" : "text-sm")}>
        {t("settings.pdfCustomSurrounding.title", "Custom PDF background colors")}
      </p>
      <div
        className={cn(
          "grid gap-1.5 overflow-y-auto",
          compact ? "max-h-36 grid-cols-1" : "grid-cols-2",
        )}
        role="group"
        aria-label={t("settings.pdfCustomSurrounding.title", "Custom PDF background colors")}
      >
        {visibleColors.map((color) => (
          <button
            key={color.id}
            type="button"
            aria-pressed={background.selectedId === color.id}
            aria-label={color.name}
            onClick={() => {
              setBackground({ ...background, selectedId: color.id });
              // Custom colors apply to the PDF surround; keep original page pixels intact.
              if (usePrefsStore.getState().pdfColorMode !== "light") setPdfColorMode("light");
            }}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-start text-xs transition-colors",
              background.selectedId === color.id
                ? "border-primary bg-accent/60 text-foreground ring-1 ring-primary/40"
                : "border-border bg-background/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className="size-4 shrink-0 rounded-full border border-foreground/20"
              style={{ backgroundColor: color.color }}
            />
            <span className="min-w-0 flex-1 truncate">{color.name}</span>
            {background.selectedId === color.id && <Check aria-hidden="true" className="size-3.5" />}
          </button>
        ))}
      </div>
    </section>
  );
}
