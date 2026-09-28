/* @vitest-environment happy-dom */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

vi.mock("@renderer/components/ui/tabs", () => {
  const Container = ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children);
  return {
    Tabs: Container,
    TabsContent: Container,
    TabsList: Container,
    TabsTrigger: ({ children, value }: { children?: ReactNode; value?: string }) =>
      createElement("button", { "data-value": value }, children),
  };
});

vi.mock("@renderer/components/ui/button", () => ({
  Button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement("button", props, children),
}));

vi.mock("./BookCard", () => ({
  BookCard: () => createElement("header", null, "Repeated book title", "Repeated author"),
}));

vi.mock("./ChapterList", () => ({ ChapterList: () => null }));
vi.mock("./AnnotationsList", () => ({ AnnotationsList: () => null }));
vi.mock("@renderer/ai/ConversationsTab", () => ({ ConversationsTab: () => null }));
vi.mock("@renderer/book-notes/BookNotesPanel", () => ({ BookNotesPanel: () => null }));
vi.mock("./VocabularyList", () => ({ VocabularyList: () => null }));
vi.mock("./PdfBookmarksList", () => ({ PdfBookmarksList: () => null }));
vi.mock("./PdfThumbnailsPanel", () => ({ PdfThumbnailsPanel: () => null }));

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

describe("PDF reader sidebar controls", () => {
  it("keeps only Contents and Pages navigation and exposes a labeled collapse button", () => {
    const onCollapseSidebar = vi.fn();
    act(() => {
      root.render(
        createElement(Sidebar, {
          bookId: "book-1",
          format: "pdf",
          pdfNavigation: null,
          pdfTocView: "contents",
          onPdfTocViewChange: vi.fn(),
          onCollapseSidebar,
        }),
      );
    });

    expect(host.textContent).toContain("Pages");
    expect(host.textContent).toContain("Contents");
    expect(host.textContent).not.toContain("Repeated book title");
    expect(host.textContent).not.toContain("Repeated author");
    for (const removedSection of ["Annotations", "Vocabulary", "Conversations", "Bookmarks"]) {
      expect(host.textContent).not.toContain(removedSection);
    }
    const navigationTabs = [...host.querySelectorAll<HTMLButtonElement>("button[data-value]")];
    expect(navigationTabs.map((button) => button.dataset.value)).toEqual(["contents", "pages"]);
    const collapse = host.querySelector<HTMLButtonElement>('button[aria-label="Collapse sidebar"]');
    expect(collapse).not.toBeNull();
    expect(collapse?.getAttribute("aria-expanded")).toBe("true");

    act(() => collapse?.click());
    expect(onCollapseSidebar).toHaveBeenCalledOnce();
  });
});
