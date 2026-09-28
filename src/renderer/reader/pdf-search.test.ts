import { describe, expect, it } from "vitest";
import * as pdfSearchModule from "./pdf-search";
import {
  DEFAULT_PDF_SEARCH_OPTIONS,
  findPdfTextMatches,
  type PdfSearchOptions,
} from "./pdf-search";

interface PdfSearchSnippetPart {
  text: string;
  match: boolean;
}

type PdfSearchModuleWithSnippet = typeof pdfSearchModule & {
  splitPdfSearchSnippet?: (
    snippet: string,
    query: string,
    options: PdfSearchOptions,
  ) => PdfSearchSnippetPart[];
};

const splitSnippet = (
  snippet: string,
  query: string,
  options: PdfSearchOptions = { caseSensitive: false, wholeWord: false },
) =>
  (pdfSearchModule as PdfSearchModuleWithSnippet).splitPdfSearchSnippet?.(snippet, query, options);

describe("findPdfTextMatches", () => {
  const options = { caseSensitive: false, wholeWord: false };

  it("defaults search to whole words so short queries do not mark substrings", () => {
    const text = "the There these other thecopyright";
    const matches = findPdfTextMatches(text, "the", DEFAULT_PDF_SEARCH_OPTIONS);

    expect(DEFAULT_PDF_SEARCH_OPTIONS).toEqual({ caseSensitive: false, wholeWord: true });
    expect(matches.map(({ start, end }) => text.slice(start, end))).toEqual(["the"]);
  });

  it("uses layout-aware text for readable snippets and raw text for PDF offsets", () => {
    const rawText = "The Scaling Playbook PerformanceKhi catalog";
    const layoutText = "The Scaling Playbook\nPerformance\nKhi catalog";

    const [match] = findPdfTextMatches(rawText, "Performance", options, layoutText);

    expect(match).toMatchObject({
      start: rawText.indexOf("Performance"),
      end: rawText.indexOf("Performance") + "Performance".length,
      snippet: "The Scaling Playbook Performance Khi catalog",
    });
  });

  it("falls back to raw snippets when layout text has different search matches", () => {
    const rawText = "Performance first. Performance second.";
    const layoutText = "Performance first. No result second.";

    const matches = findPdfTextMatches(rawText, "Performance", options, layoutText);

    expect(matches).toHaveLength(2);
    expect(matches[1]?.snippet).toContain("Performance second.");
  });
});

describe("splitPdfSearchSnippet", () => {
  it("marks every case-insensitive occurrence in a snippet", () => {
    expect(splitSnippet("Tokenization then tokenization.", "tokenization")).toEqual([
      { text: "Tokenization", match: true },
      { text: " then ", match: false },
      { text: "tokenization", match: true },
      { text: ".", match: false },
    ]);
  });

  it("matches multiword queries across variable whitespace", () => {
    expect(splitSnippet("A code   review helps.", "code review")).toEqual([
      { text: "A ", match: false },
      { text: "code   review", match: true },
      { text: " helps.", match: false },
    ]);
  });

  it("honors case-sensitive whole-word options", () => {
    expect(
      splitSnippet("Delta delta deltaValue", "delta", {
        caseSensitive: true,
        wholeWord: true,
      }),
    ).toEqual([
      { text: "Delta ", match: false },
      { text: "delta", match: true },
      { text: " deltaValue", match: false },
    ]);
  });

  it("returns an unmatched segment for an empty query", () => {
    expect(splitSnippet("Keep this snippet.", "  ")).toEqual([
      { text: "Keep this snippet.", match: false },
    ]);
  });
});
