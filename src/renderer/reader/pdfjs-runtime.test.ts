import { describe, expect, it } from "vitest";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { makeTextPdf } from "../../../packages/pdf-parser/src/fixture";

describe("PDF.js renderer runtime", () => {
  it("extracts embedded text from a generated PDF", async () => {
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({
      data: await makeTextPdf({ outline: false }),
    });
    const doc = await loadingTask.promise;
    try {
      const page = await doc.getPage(1);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      expect(text).toContain("body text of page 1");
    } finally {
      await loadingTask.destroy();
    }
  });
});
