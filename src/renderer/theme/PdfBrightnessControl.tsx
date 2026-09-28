import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";

export function PdfBrightnessControl({
  value,
  onChange,
  surroundingValue,
  onSurroundingChange,
}: {
  value: number;
  onChange: (value: number) => void;
  surroundingValue: number;
  onSurroundingChange: (value: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <BrightnessSlider
        label={t("settings.pdfPageBrightness", "PDF page brightness")}
        description={t(
          "settings.pdfPageBrightnessDesc",
          "Changes the visible PDF page only. The source file stays unchanged.",
        )}
        value={value}
        onChange={onChange}
      />
      <BrightnessSlider
        label={t("settings.pdfSurroundingBrightness", "Surrounding background brightness")}
        description={t(
          "settings.pdfSurroundingBrightnessDesc",
          "Changes the area around PDF pages only.",
        )}
        value={surroundingValue}
        onChange={onSurroundingChange}
      />
    </div>
  );
}

function BrightnessSlider({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <label htmlFor={id} className="min-w-0 flex-1 text-xs font-medium">
          {label}
        </label>
        <output htmlFor={id} className="min-w-10 text-right text-xs tabular-nums text-muted-foreground">
          {value}%
        </output>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={value === 100}
          onClick={() => onChange(100)}
        >
          <RotateCcw aria-hidden="true" />
          {t("settings.appBackground.reset", "Reset")}
        </Button>
      </div>
      <input
        id={id}
        type="range"
        min={50}
        max={150}
        step={5}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-4 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </section>
  );
}
