import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { makeTextPdf } from "../../../packages/pdf-parser/src/fixture";
import {
  exportPdfAnnotations,
  pdfAnnotationColor,
  pdfQuadsFromClientRects,
} from "./pdf-annotation-export";

it("converts text-layer rectangles to PDF highlight quads in reading order", () => {
  const quads = pdfQuadsFromClientRects(
    [
      { left: 25, top: 46, width: 40, height: 10 },
      { left: 25, top: 60, width: 0.4, height: 10 },
    ],
    { left: 5, top: 6 },
    { convertToPdfPoint: (x, y) => [2 * x, 200 - 2 * y] },
  );

  expect(quads).toEqual([[40, 120, 120, 120, 40, 100, 120, 100]]);
});

describe("PDF annotation export", () => {
  it("converts a custom hex style to a portable PDF highlight color", () => {
    expect(pdfAnnotationColor("#ff8000")).toEqual({ color: [255, 128, 0], opacity: 0.45 });
  });

  it("writes a portable highlight and note that remain after reopening the PDF", async () => {
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const source = await makeTextPdf({ outline: false, pages: 1 });
    const originalTask = pdfjs.getDocument({ data: source });
    const original = await originalTask.promise;

    try {
      const exported = await exportPdfAnnotations(original, [
        {
          id: "annotation-1",
          page: 1,
          style: "yellow",
          note: "Keep this definition.",
          quads: [[40, 568, 180, 568, 40, 554, 180, 554]],
        },
      ]);
      const savedTask = pdfjs.getDocument({ data: exported });
      const saved = await savedTask.promise;

      try {
        const [annotation] = await (await saved.getPage(1)).getAnnotations();
        expect(annotation?.annotationType).toBe(pdfjs.AnnotationType.HIGHLIGHT);
        expect(Array.from(annotation?.quadPoints ?? [])).toEqual([
          40, 568, 180, 568, 40, 554, 180, 554,
        ]);
        expect(annotation?.contentsObj?.str).toBe("Keep this definition.");
      } finally {
        await savedTask.destroy();
      }
    } finally {
      await originalTask.destroy();
    }
  });

  it("removes this app's prior exported marks when the user deletes them", async () => {
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const source = await makeTextPdf({ outline: false, pages: 1 });
    const loadingTask = pdfjs.getDocument({ data: source });
    const document = await loadingTask.promise;

    try {
      await exportPdfAnnotations(document, [
        {
          id: "annotation-to-delete",
          page: 1,
          style: "green",
          note: "",
          quads: [[40, 568, 180, 568, 40, 554, 180, 554]],
        },
      ]);
      const afterDelete = await exportPdfAnnotations(document, []);
      const reopenedTask = pdfjs.getDocument({ data: afterDelete });
      const reopened = await reopenedTask.promise;

      try {
        const annotations = await (await reopened.getPage(1)).getAnnotations();
        expect(
          annotations.filter((item) => item.annotationType === pdfjs.AnnotationType.HIGHLIGHT),
        ).toHaveLength(0);
      } finally {
        await reopenedTask.destroy();
      }
    } finally {
      await loadingTask.destroy();
    }
  });
});
