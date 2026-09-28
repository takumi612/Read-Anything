import { useTranslation } from "react-i18next";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { LanguageSwitcher } from "@renderer/i18n/LanguageSwitcher";
import { ApplicationBackgroundControls } from "@renderer/theme/ApplicationBackgroundControls";
import { PageColorModeControl } from "@renderer/theme/PageColorModeControl";
import { PdfSurroundingColorPicker } from "@renderer/theme/PdfSurroundingColorPicker";
import { AnnotationPaletteSettings } from "./AnnotationPaletteSettings";
import { PdfSurroundingColorsSettings } from "./PdfSurroundingColorsSettings";

export function AppearanceSettings() {
  const { t } = useTranslation();
  const epubColorMode = usePrefsStore((s) => s.epubColorMode);
  const setEpubColorMode = usePrefsStore((s) => s.setEpubColorMode);
  const pdfColorMode = usePrefsStore((s) => s.pdfColorMode);
  const setPdfColorMode = usePrefsStore((s) => s.setPdfColorMode);
  const pdfSurroundingBackground = usePrefsStore((s) => s.pdfSurroundingBackground);
  const setPdfSurroundingBackground = usePrefsStore((s) => s.setPdfSurroundingBackground);
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-lg">{t("settings.appearance", "Appearance")}</h2>
      <PageColorModeControl
        label={t("settings.epubColorMode", "EPUB page colors")}
        description={t(
          "settings.epubColorModeDesc",
          "Changes EPUB page and text colors only. PDF pages and the application background stay separate.",
        )}
        value={epubColorMode}
        onChange={setEpubColorMode}
      />
      <PageColorModeControl
        label={t("settings.pdfColorMode", "PDF surrounding background")}
        description={t(
          "settings.pdfColorModeDesc",
          "PDF only. Paper tones change the area around pages and preserve scanned page pixels. Dark and System use PDF's page display setting; EPUB and application backgrounds are separate.",
        )}
        value={pdfColorMode}
        onChange={(mode) => {
          setPdfColorMode(mode);
          if (pdfSurroundingBackground.selectedId !== null) {
            setPdfSurroundingBackground({ ...pdfSurroundingBackground, selectedId: null });
          }
        }}
      />
      <PdfSurroundingColorPicker />
      <PdfSurroundingColorsSettings />
      <ApplicationBackgroundControls />
      <AnnotationPaletteSettings />
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-medium">{t("settings.language", "Language")}</span>
        <LanguageSwitcher />
      </div>
    </section>
  );
}
