/* @vitest-environment happy-dom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import { qk } from "@renderer/query/keys";
import { VocabularyList } from "./VocabularyList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: { term?: string }) =>
      (fallback ?? _key).replace("{{term}}", options?.term ?? ""),
  }),
}));

const entry: VocabularyEntryDto = {
  id: "entry-1",
  bookId: "book-1",
  term: "microservices",
  normalizedTerm: "microservices",
  meaning: "[Kiến trúc phần mềm] dịch vụ nhỏ có thể triển khai độc lập",
  context: "The application uses microservices.",
  sourcePage: 20,
  createdAt: 1,
  updatedAt: 1,
  overrides: [],
};

class TestUtterance {
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: ((error?: unknown) => void) | null = null;

  constructor(readonly text: string) {}
}

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
let speak: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(qk.vocabulary("book-1"), [entry]);
  speak = vi.fn();
  const localVoice = {
    name: "Installed English",
    lang: "en-US",
    localService: true,
    default: true,
    voiceURI: "local-en-US",
  } as SpeechSynthesisVoice;
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => [localVoice],
      speak,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      addEventListener: vi.fn(),
    },
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: TestUtterance,
  });
  window.api = {
    vocabulary: {
      list: vi.fn(async () => [entry]),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as never;
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  host.remove();
});

describe("VocabularyList", () => {
  it("shows the dictionary headword without exposing internal metadata", async () => {
    const savedMeaning =
      "@base: centralize\n1. [động từ] quá khứ của centralize\n2. tập trung hóa";
    client.setQueryData(qk.vocabulary("book-1"), [
      { ...entry, meaning: savedMeaning },
    ]);

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(VocabularyList, { bookId: "book-1" }),
        ),
      );
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Base form: centralize");
    expect(host.textContent).toContain("tập trung hóa");
    expect(host.textContent).not.toContain("@base:");

    const editButton = host.querySelector<HTMLButtonElement>('button[aria-label="Edit meaning"]');
    await act(async () => editButton?.click());
    const editor = host.querySelector<HTMLTextAreaElement>("textarea");
    expect(editor?.value).not.toContain("@base:");

    const saveButton = host.querySelector<HTMLButtonElement>('button[aria-label="Save meaning"]');
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });
    expect(window.api.vocabulary.update).toHaveBeenCalledWith(
      { id: entry.id, meaning: savedMeaning },
      expect.any(Object),
    );
  });

  it("speaks a saved technical term with an installed local English voice", async () => {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(VocabularyList, { bookId: "book-1" }),
        ),
      );
      await Promise.resolve();
    });

    const button = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Listen to pronunciation"]',
    );
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    await act(async () => button?.click());

    expect(speak).toHaveBeenCalledOnce();
    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: "microservices",
      voice: { name: "Installed English", localService: true },
    });
  });
});
