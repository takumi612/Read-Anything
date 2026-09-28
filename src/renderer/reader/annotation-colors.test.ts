import { describe, expect, it } from "vitest";
import type { AnnotationDto } from "@shared/annotations";
import {
  annotationColorRgba,
  countAnnotationsByStyle,
  filterAnnotationsByStyle,
  fallbackToolbarHighlightStyle,
  groupAnnotationsByStyle,
  resolveToolbarHighlightStyle,
  setToolbarColorEnabled,
} from "./annotation-colors";

const annotation = (id: string, style: AnnotationDto["style"]): AnnotationDto => ({
  id,
  bookId: "book-1",
  style,
  note: "",
  selectedText: id,
  locatorRange: "",
  createdAt: 1,
  updatedAt: 1,
});

describe("annotation color helpers", () => {
  const annotations = [
    annotation("yellow-new", "yellow"),
    annotation("blue", "blue"),
    annotation("yellow-old", "yellow"),
    annotation("underline", "underline"),
  ];

  it("counts annotation styles, including only colors currently used", () => {
    expect(countAnnotationsByStyle(annotations)).toMatchObject({
      yellow: 2,
      blue: 1,
      underline: 1,
      green: 0,
      pink: 0,
      purple: 0,
    });
  });

  it("filters by one style and preserves the existing newest-first order", () => {
    expect(filterAnnotationsByStyle(annotations, "yellow").map(({ id }) => id)).toEqual([
      "yellow-new",
      "yellow-old",
    ]);
    expect(filterAnnotationsByStyle(annotations, null)).toEqual(annotations);
  });

  it("groups used styles in picker order while preserving order within each group", () => {
    expect(
      groupAnnotationsByStyle(annotations).map(({ style, annotations: items }) => [
        style,
        items.map(({ id }) => id),
      ]),
    ).toEqual([
      ["yellow", ["yellow-new", "yellow-old"]],
      ["blue", ["blue"]],
      ["underline", ["underline"]],
    ]);
  });

  it("turns a persisted custom hex color into an opaque-safe annotation color", () => {
    expect(annotationColorRgba("#ff8000", 0.7)).toBe("rgba(255, 128, 0, 0.7)");
  });

  it("uses only an enabled color when the last-used style is no longer in the toolbar", () => {
    expect(resolveToolbarHighlightStyle("#ff8000", ["blue", "green"])).toBe("blue");
    expect(resolveToolbarHighlightStyle("blue", ["blue", "green"])).toBe("blue");
  });

  it("does not enable a seventh quick-toolbar color", () => {
    const six = ["yellow", "green", "blue", "pink", "purple", "#f97316"] as const;
    expect(setToolbarColorEnabled(six, "#ff8000", true)).toEqual([...six]);
    expect(setToolbarColorEnabled(six, "#f97316", true)).toEqual([...six]);
  });

  it("chooses a surviving enabled color after deleting the selected saved color", () => {
    expect(
      fallbackToolbarHighlightStyle("#f97316", ["yellow", "#f97316"], ["yellow"]),
    ).toBe("yellow");
  });
});
