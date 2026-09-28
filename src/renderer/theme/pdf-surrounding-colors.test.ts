import { describe, expect, it } from "vitest";
import type { PdfSurroundingBackground, PdfSurroundingColor } from "@shared/preferences";
import {
  addPdfSurroundingColor,
  deletePdfSurroundingColor,
  editPdfSurroundingColor,
  resolvePdfSurroundingColor,
} from "./pdf-surrounding-colors";
import { pdfBackdropForSelection } from "@renderer/reader/pdf-page-appearance";

const first: PdfSurroundingColor = {
  id: "tone-1",
  name: "Soft sage",
  color: "#e4ece3",
  showInThemeMenu: true,
};

const second: PdfSurroundingColor = {
  id: "tone-2",
  name: "Warm parchment",
  color: "#f5f0e6",
  showInThemeMenu: true,
};

const empty: PdfSurroundingBackground = { colors: [], selectedId: null };

describe("PDF surrounding colors", () => {
  it("adds a custom tone and applies it immediately", () => {
    expect(addPdfSurroundingColor(empty, first)).toEqual({
      colors: [first],
      selectedId: first.id,
    });
  });

  it("edits a saved tone without changing its selection", () => {
    const current = { colors: [first, second], selectedId: second.id };
    expect(editPdfSurroundingColor(current, first.id, { name: "Green paper" })).toEqual({
      colors: [{ ...first, name: "Green paper" }, second],
      selectedId: second.id,
    });
  });

  it("returns to the built-in PDF tone when hiding the currently selected custom tone", () => {
    expect(
      editPdfSurroundingColor({ colors: [first], selectedId: first.id }, first.id, {
        showInThemeMenu: false,
      }),
    ).toEqual({ colors: [{ ...first, showInThemeMenu: false }], selectedId: null });
  });

  it("removes the selected tone and returns to the built-in paper mode", () => {
    expect(
      deletePdfSurroundingColor({ colors: [first, second], selectedId: first.id }, first.id),
    ).toEqual({ colors: [second], selectedId: null });
  });

  it("uses custom tones in the quick theme menu only when enabled", () => {
    const current = { colors: [first, { ...second, showInThemeMenu: false }], selectedId: null };
    expect(resolvePdfSurroundingColor(current, first.id)).toEqual(first);
    expect(resolvePdfSurroundingColor(current, second.id)).toBeNull();
  });

  it("keeps a custom tone on the PDF surround and falls back to built-in modes", () => {
    expect(pdfBackdropForSelection(first.color, "dark", "light")).toBe(first.color);
    expect(pdfBackdropForSelection(null, "sepia", "light")).toBe("#e9ddc5");
  });
});
