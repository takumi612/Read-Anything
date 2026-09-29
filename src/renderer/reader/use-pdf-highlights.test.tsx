/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { usePdfHighlights } from "./use-pdf-highlights";

describe("usePdfHighlights", () => {
  it("settles when an unannotated PDF page receives a fresh empty list", () => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let renders = 0;

    function Page() {
      renders++;
      if (renders > 10) throw new Error("PDF highlight render did not settle");
      usePdfHighlights([], null, false);
      return null;
    }

    try {
      act(() => root.render(createElement(Page)));
      expect(renders).toBeLessThan(4);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("settles when an annotated page receives equivalent new lists", () => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    const originalRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [{ x: 10, y: 20, width: 30, height: 12 }],
    });
    const layer = document.createElement("div");
    layer.textContent = "example";
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let renders = 0;

    function Page() {
      renders++;
      if (renders > 10) throw new Error("annotated PDF highlight render did not settle");
      const highlights = usePdfHighlights(
        [{ id: "a", style: "yellow", hasNote: false, start: 0, end: 3 }],
        layer,
        true,
      );
      return createElement("span", null, highlights.length);
    }

    try {
      act(() => root.render(createElement(Page)));
      expect(renders).toBeLessThan(4);
      expect(host.textContent).toBe("1");
    } finally {
      act(() => root.unmount());
      host.remove();
      if (originalRects) Object.defineProperty(Range.prototype, "getClientRects", originalRects);
      else delete (Range.prototype as Partial<Range>).getClientRects;
    }
  });
});
