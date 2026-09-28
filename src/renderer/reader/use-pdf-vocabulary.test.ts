import { describe, expect, it } from "vitest";
import { findVocabularyOccurrences } from "./use-pdf-vocabulary";
import * as vocabularyModule from "./use-pdf-vocabulary";
import type { VocabularyEntryDto } from "@shared/vocabulary";

const entry = (overrides: VocabularyEntryDto["overrides"] = []): VocabularyEntryDto => ({
  id: "entry-1",
  bookId: "book-1",
  term: "bank",
  normalizedTerm: "bank",
  meaning: "bờ sông",
  context: "The bank was high.",
  sourcePage: 1,
  createdAt: 1,
  updatedAt: 1,
  overrides,
});

describe("PDF vocabulary occurrence matching", () => {
  it("does not open a separate hover card while a text selection owns the toolbar", () => {
    const policy = (
      vocabularyModule as typeof vocabularyModule & {
        shouldShowVocabularyPreview?: (hasActiveSelection: boolean) => boolean;
      }
    ).shouldShowVocabularyPreview;

    expect(policy?.(true) ?? true).toBe(false);
  });

  it("matches case-insensitive whole words and excludes longer words", () => {
    const text = "Bank banking riverbank bank's BANK";
    const matches = findVocabularyOccurrences(text, [entry()], 2);

    expect(matches.map(({ start, end }) => text.slice(start, end))).toEqual([
      "Bank",
      "bank",
      "BANK",
    ]);
  });

  it("matches saved phrases across PDF whitespace and applies exact occurrence meanings", () => {
    const text = "scalable application\n development makes";
    const occurrence = "scalable application\n development";
    const phrase: VocabularyEntryDto = {
      ...entry(),
      term: "scalable application development",
      normalizedTerm: "scalable application development",
      overrides: [{ page: 3, start: 0, end: occurrence.length, meaning: "nghĩa riêng" }],
    };
    const matches = findVocabularyOccurrences(text, [phrase], 3);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ start: 0, meaning: "nghĩa riêng" });
    expect(text.slice(matches[0].start, matches[0].end)).toBe("scalable application\n development");
  });
});
