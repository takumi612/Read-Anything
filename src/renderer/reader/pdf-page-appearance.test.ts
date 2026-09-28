import { describe, expect, it } from "vitest";
import {
  pdfBackdropBrightnessOverlay,
  pdfBackdropForMode,
  pdfBackdropForSelection,
  pdfCanvasFilter,
  shouldInvertPdfPages,
} from "./pdf-page-appearance";

describe("shouldInvertPdfPages", () => {
  it("keeps the original PDF colors in light mode regardless of the app theme", () => {
    expect(shouldInvertPdfPages("light", "dark")).toBe(false);
  });

  it("inverts PDF pages only when the PDF appearance resolves to dark", () => {
    expect(shouldInvertPdfPages("dark", "light")).toBe(true);
    expect(shouldInvertPdfPages("system", "dark")).toBe(true);
    expect(shouldInvertPdfPages("system", "light")).toBe(false);
  });

  it("uses color themes only for the canvas around PDF pages", () => {
    expect(pdfBackdropForMode("paper", "dark")).toBe("#f5f0e6");
    expect(pdfBackdropForMode("sepia", "light")).toBe("#e9ddc5");
    expect(pdfBackdropForMode("sage", "light")).toBe("#e4ece3");
    expect(shouldInvertPdfPages("paper", "dark")).toBe(false);
    expect(shouldInvertPdfPages("sepia", "light")).toBe(false);
  });
});

describe("pdfBackdropForSelection", () => {
  it("uses a selected custom surround color, or the current built-in tone", () => {
    expect(pdfBackdropForSelection("#e4ece3", "dark", "light")).toBe("#e4ece3");
    expect(pdfBackdropForSelection(null, "sepia", "light")).toBe("#e9ddc5");
  });
});

describe("pdfCanvasFilter", () => {
  it("applies brightness after the optional dark-page inversion", () => {
    expect(pdfCanvasFilter(false, 100)).toBe("brightness(1)");
    expect(pdfCanvasFilter(false, 125)).toBe("brightness(1.25)");
    expect(pdfCanvasFilter(true, 75)).toBe("invert(1) hue-rotate(180deg) brightness(0.75)");
  });
});

describe("pdfBackdropBrightnessOverlay", () => {
  it("leaves the selected background tone unchanged at neutral brightness", () => {
    expect(pdfBackdropBrightnessOverlay(100)).toBe("none");
  });

  it("dims only the background tone below neutral brightness", () => {
    expect(pdfBackdropBrightnessOverlay(50)).toBe(
      "linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))",
    );
  });

  it("brightens only the background tone above neutral brightness", () => {
    expect(pdfBackdropBrightnessOverlay(150)).toBe(
      "linear-gradient(rgba(255, 255, 255, 0.333), rgba(255, 255, 255, 0.333))",
    );
  });
});
