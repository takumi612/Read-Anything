/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { SelectionToolbar } from "./SelectionToolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      fallback: string,
      options?: { color?: string; term?: string },
    ) =>
      fallback.replace("{{color}}", options?.color ?? "").replace("{{term}}", options?.term ?? ""),
  }),
}));
vi.mock("@renderer/ai/use-ai-actions", () => ({
  useAiActions: () => ({ startAiAction: vi.fn() }),
}));

const entry: VocabularyEntryDto = {
  id: "entry-1",
  bookId: "book-1",
  term: "machine learning",
  normalizedTerm: "machine learning",
  meaning: "[AI/ML] học quy luật từ dữ liệu",
  context: "Machine learning helps identify patterns.",
  sourcePage: 20,
  createdAt: 1,
  updatedAt: 1,
  overrides: [],
};

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let lookup: ReturnType<typeof vi.fn>;
let createAnnotation: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lookup = vi.fn(async () => entry);
  createAnnotation = vi.fn(async () => ({ id: "annotation-1" }));
  usePrefsStore.setState({ annotationPalette: ["#ff8000", "blue"] });
  useAnnotationStore.setState({
    selection: {
      selectionText: "machine\nlearning",
      paragraphBefore: null,
      paragraphCurrent: "Machine learning helps identify patterns.",
      paragraphAfter: null,
      rect: { x: 100, y: 100, width: 160, height: 22 },
      locatorRange: 'pdf:{"page":20,"start":0,"end":16}',
    },
    styleBar: null,
    noteModal: null,
  });
  useNavigationStore.setState({
    currentBookId: "book-1",
    readingContext: { format: "pdf", page: 20, pageCount: 612 },
  });
  const voice = {
    name: "Installed English",
    lang: "en-US",
    localService: true,
    default: true,
    voiceURI: "local-en-US",
  } as SpeechSynthesisVoice;
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => [voice],
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
    },
  });
  window.api = {
    vocabulary: { lookup },
    annotations: { create: createAnnotation },
  } as never;
});

afterEach(() => {
  act(() => root.unmount());
  useAnnotationStore.setState({ selection: null, styleBar: null, noteModal: null });
  useNavigationStore.setState({ currentBookId: null, readingContext: null });
  usePrefsStore.setState({ annotationPalette: ["yellow", "green", "blue", "pink", "purple", "#f97316"] });
  client.clear();
  host.remove();
});

describe("SelectionToolbar vocabulary lookup", () => {
  it("lets the reader choose a configured color before creating a highlight", async () => {
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });

    const paletteToggle = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Highlight colors"]',
    );
    expect(paletteToggle).not.toBeNull();
    await act(async () => paletteToggle?.click());

    const orange = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Highlight #ff8000"]',
    );
    expect(orange).not.toBeNull();
    await act(async () => {
      orange?.click();
      await Promise.resolve();
    });

    expect(createAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: "book-1", style: "#ff8000" }),
      expect.any(Object),
    );
  });

  it("keeps local dictionary lookup primary when the PDF context has not hydrated", async () => {
    useNavigationStore.setState({ readingContext: null });

    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });

    const labels = [...host.querySelectorAll<HTMLButtonElement>("button")].map((button) =>
      button.textContent?.trim(),
    );
    expect(labels).toContain("Look up");
    expect(labels).toContain("Ask AI");
    expect(labels).not.toContain("Explain");
    expect(labels).not.toContain("Translate");
    expect(labels).not.toContain("Summarize");
  });

  it("looks up a selected technical phrase without sending it through the AI action", async () => {
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });

    const lookupButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Look up"),
    );
    expect(lookupButton).toBeDefined();

    await act(async () => {
      lookupButton?.click();
      await Promise.resolve();
    });

    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        bookId: "book-1",
        term: "machine\nlearning",
        context: "Machine learning helps identify patterns.",
        sourcePage: 20,
      }),
      expect.any(Object),
    );
    expect(host.textContent).toContain("[AI/ML] học quy luật từ dữ liệu");
    const actions = host.querySelector("[data-selection-actions]");
    expect(actions).not.toBeNull();
    expect(actions?.className).toContain("rounded-b-none");
    expect(host.querySelector("[data-selection-lookup-panel]")?.className).toContain(
      "rounded-t-none",
    );
  });

  it("shows the dictionary headword alongside an inflected selected word", async () => {
    lookup.mockResolvedValue({
      ...entry,
      term: "centralized",
      normalizedTerm: "centralized",
      meaning: "@base: centralize\n1. [động từ] quá khứ của centralize\n2. [động từ] tập trung vào một trung tâm",
    });
    useAnnotationStore.setState({
      selection: {
        selectionText: "centralized",
        paragraphBefore: null,
        paragraphCurrent: "They centralized the service.",
        paragraphAfter: null,
        rect: { x: 100, y: 100, width: 110, height: 22 },
        locatorRange: 'pdf:{"page":20,"start":0,"end":11}',
      },
    });

    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });
    const lookupButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Look up"),
    );
    await act(async () => {
      lookupButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("centralized");
    expect(host.textContent).toContain("Base form: centralize");
    expect(host.textContent).toContain("tập trung vào một trung tâm");
  });

  it("does not cancel native mouse input inside the scrollable result", async () => {
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });
    const lookupButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Look up"),
    );
    await act(async () => {
      lookupButton?.click();
      await Promise.resolve();
    });

    const result = host.querySelector('[role="status"]');
    expect(result).not.toBeNull();
    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    result?.dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(false);
  });

  it("keeps PDF context for sense matching without showing the excerpt in the result", async () => {
    const longContext = `${"Background details from the PDF. ".repeat(8)}Machine learning${" appears in this chapter. ".repeat(12)}FULL_CONTEXT_SENTINEL`;
    lookup.mockResolvedValue({ ...entry, context: longContext });

    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });

    const lookupButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Look up"),
    );
    await act(async () => {
      lookupButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Offline dictionary");
    expect(host.textContent).not.toContain("Context in book");
    expect(host.textContent).not.toContain("FULL_CONTEXT_SENTINEL");
    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({
        term: "machine\nlearning",
        context: "Machine learning helps identify patterns.",
      }),
      expect.any(Object),
    );
  });

  it("shows an offline dictionary miss without exposing the Electron IPC error", async () => {
    lookup.mockRejectedValueOnce(
      new Error(
        "Error invoking remote method 'vocabulary:lookup': Error: Word not found in the offline dictionary.",
      ),
    );

    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(SelectionToolbar)));
      await Promise.resolve();
    });
    const lookupButton = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Look up"),
    );
    await act(async () => {
      lookupButton?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("No offline dictionary entry for");
    expect(host.textContent).not.toContain("Error invoking remote method");
    expect(host.textContent).not.toContain("Word not found in the offline dictionary");
  });
});
