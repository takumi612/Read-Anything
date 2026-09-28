/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfBook } from "./pdf-book";
import { PdfSearchPanel } from "./PdfSearchPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function renderPanel(onClose: () => void) {
  const book = {
    pageCount: 1,
    readPageText: vi.fn(async () => ({ text: "", snippetText: "" })),
  } as unknown as PdfBook;
  act(() => {
    root.render(
      createElement(PdfSearchPanel, {
        book,
        query: "pearls",
        options: { caseSensitive: false, wholeWord: false },
        onQueryChange: vi.fn(),
        onOptionsChange: vi.fn(),
        onJump: vi.fn(),
        onClose,
      }),
    );
  });
}

describe("PdfSearchPanel outside interaction", () => {
  it("dismisses on a pointer press outside the panel", async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    const outside = document.createElement("button");
    host.append(outside);

    await act(async () => {
      outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open when the pointer press is inside the panel", async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    const panel = host.querySelector("section");

    await act(async () => {
      panel?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
