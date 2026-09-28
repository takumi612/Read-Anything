import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import type { ReaderColorMode } from "@shared/preferences";

const PAGE_COLOR_OPTIONS: {
  value: ReaderColorMode;
  key: string;
  fallback: string;
  swatch: string;
}[] = [
  { value: "light", key: "settings.pageTone.original", fallback: "Original", swatch: "bg-white" },
  { value: "paper", key: "settings.pageTone.paper", fallback: "Warm paper", swatch: "bg-amber-50" },
  { value: "sepia", key: "settings.pageTone.sepia", fallback: "Sepia", swatch: "bg-amber-200" },
  {
    value: "sage",
    key: "settings.pageTone.sage",
    fallback: "Soft green",
    swatch: "bg-emerald-100",
  },
  { value: "dark", key: "settings.pageTone.dark", fallback: "Dark", swatch: "bg-slate-900" },
  {
    value: "system",
    key: "settings.pageTone.system",
    fallback: "System",
    swatch: "bg-gradient-to-r from-white to-slate-900",
  },
];

export function PageColorModeControl({
  label,
  description,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  description?: string;
  value: ReaderColorMode;
  onChange: (mode: ReaderColorMode) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn("space-y-2 border-t border-border", compact ? "pt-3" : "pt-4")}>
      <div>
        <p className={cn("font-medium", compact ? "px-1 text-xs" : "text-sm")}>{label}</p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div
        className={cn("grid gap-2", compact ? "grid-cols-2 gap-1.5" : "grid-cols-3")}
        role="group"
        aria-label={label}
      >
        {PAGE_COLOR_OPTIONS.map((option) => {
          const optionLabel = t(option.key, option.fallback);
          return (
            <button
              key={option.value}
              type="button"
              aria-label={optionLabel}
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-w-0 cursor-pointer items-center rounded-lg border text-start text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                compact ? "h-9 gap-2 px-2" : "gap-2 px-2.5 py-2",
                value === option.value
                  ? "border-primary bg-accent/60 text-foreground ring-1 ring-primary/40"
                  : "border-border bg-background/60 text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 rounded-full border border-foreground/20",
                  option.swatch,
                )}
              />
              <span className="truncate">{optionLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
