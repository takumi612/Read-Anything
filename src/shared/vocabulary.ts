import { z } from "zod";

const lookupToken = /^(?=.*[\p{L}\p{N}])[\p{L}\p{N}.][\p{L}\p{N}\p{M}'’+#/.-]*$/u;

/** Only short word or technical-phrase selections belong in the dictionary lookup action. */
export function isVocabularyLookupTerm(term: string): boolean {
  const normalized = term.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > 120) return false;
  const words = normalized.split(" ");
  return words.length <= 4 && words.every((word) => lookupToken.test(word));
}

/** A short English phrase can be saved from an inline translation without a dictionary entry. */
export function isSaveableVocabularyPhrase(term: string): boolean {
  const normalized = term.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > 160 || /[.!?。！？]$/u.test(normalized)) return false;
  const words = normalized.split(" ");
  return words.length >= 2 && words.length <= 8 && words.every((word) => lookupToken.test(word));
}

export const vocabularyLookupInput = z.object({
  bookId: z.string().min(1),
  term: z.string().trim().min(1).max(120).refine(isVocabularyLookupTerm),
  context: z.string().trim().max(1200),
  sourcePage: z.number().int().positive(),
});

export const vocabularySavePhraseInput = z.object({
  bookId: z.string().min(1),
  term: z.string().trim().refine(isSaveableVocabularyPhrase),
  meaning: z.string().trim().min(1).max(2000),
  context: z.string().trim().max(1200),
  sourcePage: z.number().int().positive(),
});

export const vocabularyUpdateInput = z.object({
  id: z.string().min(1),
  meaning: z.string().trim().min(1).max(2000),
});

export const vocabularyDeleteInput = z.object({ id: z.string().min(1) });

export const vocabularyOccurrenceInput = z.object({
  entryId: z.string().min(1),
  page: z.number().int().positive(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  meaning: z.string().trim().min(1).max(2000),
});

export interface VocabularyEntryDto {
  id: string;
  bookId: string;
  term: string;
  normalizedTerm: string;
  meaning: string;
  context: string;
  sourcePage: number;
  createdAt: number;
  updatedAt: number;
  overrides: Array<{ page: number; start: number; end: number; meaning: string }>;
}
