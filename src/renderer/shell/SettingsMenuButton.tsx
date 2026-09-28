import { Check, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@renderer/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@renderer/components/ui/tooltip";
import { PageColorModeControl } from "@renderer/theme/PageColorModeControl";
import { PdfSurroundingColorPicker } from "@renderer/theme/PdfSurroundingColorPicker";
import { PdfBrightnessControl } from "@renderer/theme/PdfBrightnessControl";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useThemeStore } from "@renderer/store/theme-store";

const modes = [
  { value: "light", key: "settings.light", fallback: "Light", icon: Sun },
  { value: "system", key: "settings.system", fallback: "System", icon: Monitor },
  { value: "dark", key: "settings.dark", fallback: "Dark", icon: Moon },
] as const;

export function SettingsMenuButton({
  onOpenSettings,
  documentFormat = null,
}: {
  onOpenSettings: () => void;
  documentFormat?: "epub" | "pdf" | null;
}) {
  const { t } = useTranslation();
  const colorMode = useThemeStore((s) => s.colorMode);
  const setColorMode = useThemeStore((s) => s.setColorMode);
  const epubColorMode = usePrefsStore((s) => s.epubColorMode);
  const setEpubColorMode = usePrefsStore((s) => s.setEpubColorMode);
  const pdfColorMode = usePrefsStore((s) => s.pdfColorMode);
  const setPdfColorMode = usePrefsStore((s) => s.setPdfColorMode);
  const pdfSurroundingBackground = usePrefsStore((s) => s.pdfSurroundingBackground);
  const setPdfSurroundingBackground = usePrefsStore((s) => s.setPdfSurroundingBackground);
  const pdfBrightness = usePrefsStore((s) => s.pdfBrightness);
  const setPdfBrightness = usePrefsStore((s) => s.setPdfBrightness);
  const pdfSurroundingBrightness = usePrefsStore((s) => s.pdfSurroundingBrightness);
  const setPdfSurroundingBrightness = usePrefsStore((s) => s.setPdfSurroundingBrightness);
  const selectedMode = modes.find((mode) => mode.value === colorMode) ?? modes[1];
  const ThemeIcon = selectedMode.icon;
  const themeLabel = t("settings.colorMode", "Application theme");

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${themeLabel}: ${t(selectedMode.key, selectedMode.fallback)}`}
              title={`${themeLabel}: ${t(selectedMode.key, selectedMode.fallback)}`}
              className="text-muted-foreground"
            />
          }
        >
          <ThemeIcon aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-64 max-w-[calc(100vw-1rem)] gap-0 p-2"
        >
          <section className="space-y-0.5" role="group" aria-label={themeLabel}>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">{themeLabel}</div>
            {modes.map(({ value, key, fallback, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={colorMode === value}
                onClick={() => setColorMode(value)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
              >
                <Icon aria-hidden="true" className="size-4" />
                <span className="flex flex-1 items-center justify-between gap-2">
                  {t(key, fallback)}
                  {colorMode === value && <Check aria-hidden="true" className="text-primary" />}
                </span>
              </button>
            ))}
          </section>
          {documentFormat === "epub" && (
            <PageColorModeControl
              compact
              label={t("settings.epubColorMode", "EPUB page colors")}
              value={epubColorMode}
              onChange={setEpubColorMode}
            />
          )}
          {documentFormat === "pdf" && (
            <>
              <PageColorModeControl
                compact
                label={t("settings.pdfColorMode", "PDF surrounding background")}
                value={pdfColorMode}
                onChange={(mode) => {
                  setPdfColorMode(mode);
                  if (pdfSurroundingBackground.selectedId !== null) {
                    setPdfSurroundingBackground({
                      ...pdfSurroundingBackground,
                      selectedId: null,
                    });
                  }
                }}
              />
              <PdfSurroundingColorPicker compact />
              <PdfBrightnessControl
                value={pdfBrightness}
                onChange={setPdfBrightness}
                surroundingValue={pdfSurroundingBrightness}
                onSurroundingChange={setPdfSurroundingBrightness}
              />
            </>
          )}
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              aria-label={t("settings.title", "Settings")}
              title={t("settings.title", "Settings")}
              className="text-muted-foreground"
            />
          }
        >
          <Settings aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>{t("settings.title", "Settings")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
