import type { ReaderColorMode } from "@shared/preferences";
import type { ResolvedTheme } from "@shared/theme";

/** PDF page colors follow their own preference, never the application's chrome theme. */
export function shouldInvertPdfPages(
  pdfColorMode: ReaderColorMode,
  systemTheme: ResolvedTheme,
): boolean {
  return pdfColorMode === "dark" || (pdfColorMode === "system" && systemTheme === "dark");
}

/** Apply brightness only to rendered page canvases; text and annotation overlays remain untouched. */
export function pdfCanvasFilter(invert: boolean, brightnessPercent: number): string {
  const brightness = Math.max(50, Math.min(150, brightnessPercent)) / 100;
  const base = invert ? "invert(1) hue-rotate(180deg) " : "";
  return `${base}brightness(${brightness})`;
}

/** Adjust the PDF surround without applying a CSS filter to rendered pages or annotations. */
export function pdfBackdropBrightnessOverlay(brightnessPercent: number): string {
  const brightness = Math.max(50, Math.min(150, brightnessPercent));
  if (brightness === 100) return "none";

  const alpha =
    brightness < 100 ? (100 - brightness) / 100 : 1 - 100 / brightness;
  const color = brightness < 100 ? "0, 0, 0" : "255, 255, 255";
  const opacity = Number(alpha.toFixed(3));
  const colorStop = `rgba(${color}, ${opacity})`;
  return `linear-gradient(${colorStop}, ${colorStop})`;
}

/** Paper themes recolor only the canvas around PDF pages, preserving the rendered page pixels. */
export function pdfBackdropForMode(
  pdfColorMode: ReaderColorMode,
  systemTheme: ResolvedTheme,
): string {
  switch (pdfColorMode) {
    case "paper":
      return "#f5f0e6";
    case "sepia":
      return "#e9ddc5";
    case "sage":
      return "#e4ece3";
    case "dark":
      return "#15181c";
    case "system":
      return systemTheme === "dark" ? "#15181c" : "#e6e8eb";
    case "light":
      return "#e6e8eb";
  }
}

/** A saved custom tone replaces only the area around PDF pages. */
export function pdfBackdropForSelection(
  customColor: string | null,
  pdfColorMode: ReaderColorMode,
  systemTheme: ResolvedTheme,
): string {
  return customColor ?? pdfBackdropForMode(pdfColorMode, systemTheme);
}
