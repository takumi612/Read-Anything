import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { vocabularyEntries, vocabularyOverrides } from "@main/db/schema";
import type { LocalDictionary, LocalDictionaryEntry } from "@main/vocabulary/local-dictionary";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import { isSaveableVocabularyPhrase, isVocabularyLookupTerm } from "@shared/vocabulary";
import { t } from "@main/i18n";

type EntryRow = typeof vocabularyEntries.$inferSelect;
type OverrideRow = typeof vocabularyOverrides.$inferSelect;

export function normalizeVocabularyTerm(term: string): string {
  return term.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

function toDto(row: EntryRow, overrides: OverrideRow[]): VocabularyEntryDto {
  return {
    ...row,
    overrides: overrides.map(({ page, start, end, meaning }) => ({ page, start, end, meaning })),
  };
}

export function listVocabulary(db: DB, bookId: string): VocabularyEntryDto[] {
  const entries = db
    .select()
    .from(vocabularyEntries)
    .where(eq(vocabularyEntries.bookId, bookId))
    .orderBy(asc(vocabularyEntries.createdAt))
    .all();
  if (entries.length === 0) return [];
  const overrides = db
    .select()
    .from(vocabularyOverrides)
    .where(
      inArray(
        vocabularyOverrides.entryId,
        entries.map((entry) => entry.id),
      ),
    )
    .all();
  const byEntry = new Map<string, OverrideRow[]>();
  for (const override of overrides) {
    const rows = byEntry.get(override.entryId) ?? [];
    rows.push(override);
    byEntry.set(override.entryId, rows);
  }
  return entries.map((entry) => toDto(entry, byEntry.get(entry.id) ?? []));
}

function getEntry(db: DB, id: string): VocabularyEntryDto {
  const row = db.select().from(vocabularyEntries).where(eq(vocabularyEntries.id, id)).get();
  if (!row) throw new Error(t("errors.vocabularyNotFound"));
  const overrides = db
    .select()
    .from(vocabularyOverrides)
    .where(eq(vocabularyOverrides.entryId, id))
    .all();
  return toDto(row, overrides);
}

function formatDictionaryEntry(entry: LocalDictionaryEntry): string {
  const baseForm = entry.baseTerm && entry.baseTerm !== entry.term ? `@base: ${entry.baseTerm}` : null;
  const pronunciations = entry.pronunciations
    .map(({ ipa, region }) => `${ipa}${region ? ` (${region})` : ""}`)
    .join(" · ");
  const lines = entry.senses.map((sense, index) => {
    const partOfSpeech = [sense.partOfSpeech, sense.subPartOfSpeech]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" · ");
    const domain = sense.domain?.trim() ? `[${sense.domain.trim()}] ` : "";
    const heading = `${index + 1}. ${domain}${partOfSpeech ? `[${partOfSpeech}] ` : ""}${sense.meaning}`;
    return sense.example ? `${heading}\n   ${sense.example}` : heading;
  });
  return [baseForm, pronunciations, ...lines].filter(Boolean).join("\n").slice(0, 2000);
}

/** Reads the bundled local dictionary and saves a successful lookup once per PDF. */
export function lookupVocabulary(
  db: DB,
  input: { bookId: string; term: string; context: string; sourcePage: number },
  dictionary: LocalDictionary,
): VocabularyEntryDto {
  const normalizedTerm = normalizeVocabularyTerm(input.term);
  if (!isVocabularyLookupTerm(normalizedTerm)) throw new Error(t("errors.vocabularyInvalidTerm"));
  const existing = db
    .select()
    .from(vocabularyEntries)
    .where(
      and(
        eq(vocabularyEntries.bookId, input.bookId),
        eq(vocabularyEntries.normalizedTerm, normalizedTerm),
      ),
    )
    .get();
  if (existing) return getEntry(db, existing.id);
  const result = dictionary.lookup(normalizedTerm, input.context);
  if (!result) {
    throw new Error(t("errors.vocabularyMissingOffline"));
  }
  const meaning = formatDictionaryEntry(result);
  if (!meaning) throw new Error(t("errors.vocabularyMissingMeaning"));
  const inserted = db
    .insert(vocabularyEntries)
    .values({
      bookId: input.bookId,
      term: input.term.trim(),
      normalizedTerm,
      meaning,
      context: input.context.trim(),
      sourcePage: input.sourcePage,
    })
    .onConflictDoNothing()
    .returning()
    .get();
  if (inserted) return toDto(inserted, []);
  const concurrent = db
    .select()
    .from(vocabularyEntries)
    .where(
      and(
        eq(vocabularyEntries.bookId, input.bookId),
        eq(vocabularyEntries.normalizedTerm, normalizedTerm),
      ),
    )
    .get();
  if (!concurrent) throw new Error(t("errors.vocabularySaveFailed"));
  return getEntry(db, concurrent.id);
}

/** Save a user-approved AI translation; never call the dictionary or AI while saving. */
export function saveVocabularyPhrase(
  db: DB,
  input: { bookId: string; term: string; meaning: string; context: string; sourcePage: number },
): VocabularyEntryDto {
  const normalizedTerm = normalizeVocabularyTerm(input.term);
  if (!isSaveableVocabularyPhrase(input.term)) throw new Error(t("errors.vocabularyInvalidTerm"));
  const existing = db
    .select()
    .from(vocabularyEntries)
    .where(
      and(
        eq(vocabularyEntries.bookId, input.bookId),
        eq(vocabularyEntries.normalizedTerm, normalizedTerm),
      ),
    )
    .get();
  if (existing) return getEntry(db, existing.id);
  const inserted = db
    .insert(vocabularyEntries)
    .values({
      bookId: input.bookId,
      term: input.term.trim(),
      normalizedTerm,
      meaning: input.meaning.trim(),
      context: input.context.trim(),
      sourcePage: input.sourcePage,
    })
    .onConflictDoNothing()
    .returning()
    .get();
  if (inserted) return toDto(inserted, []);
  const concurrent = db
    .select()
    .from(vocabularyEntries)
    .where(
      and(
        eq(vocabularyEntries.bookId, input.bookId),
        eq(vocabularyEntries.normalizedTerm, normalizedTerm),
      ),
    )
    .get();
  if (!concurrent) throw new Error(t("errors.vocabularySaveFailed"));
  return getEntry(db, concurrent.id);
}

export function updateVocabulary(db: DB, id: string, meaning: string): VocabularyEntryDto {
  const row = db
    .update(vocabularyEntries)
    .set({ meaning: meaning.trim(), updatedAt: Date.now() })
    .where(eq(vocabularyEntries.id, id))
    .returning()
    .get();
  if (!row) throw new Error(t("errors.vocabularyNotFound"));
  return getEntry(db, row.id);
}

/** Re-read the bundled dictionary without changing per-occurrence meanings. */
export function refreshVocabulary(
  db: DB,
  id: string,
  dictionary: LocalDictionary,
): VocabularyEntryDto {
  const row = db.select().from(vocabularyEntries).where(eq(vocabularyEntries.id, id)).get();
  if (!row) throw new Error(t("errors.vocabularyNotFound"));
  const result = dictionary.lookup(row.normalizedTerm, row.context);
  if (!result) throw new Error(t("errors.vocabularyMissingOffline"));
  const meaning = formatDictionaryEntry(result);
  if (!meaning) throw new Error(t("errors.vocabularyMissingMeaning"));
  return updateVocabulary(db, id, meaning);
}

export function deleteVocabulary(db: DB, id: string): void {
  db.delete(vocabularyEntries).where(eq(vocabularyEntries.id, id)).run();
}

export function setVocabularyOccurrence(
  db: DB,
  input: { entryId: string; page: number; start: number; end: number; meaning: string },
): void {
  if (input.end <= input.start) throw new Error(t("errors.vocabularyInvalidOccurrence"));
  db.insert(vocabularyOverrides)
    .values({ ...input, meaning: input.meaning.trim() })
    .onConflictDoUpdate({
      target: [
        vocabularyOverrides.entryId,
        vocabularyOverrides.page,
        vocabularyOverrides.start,
        vocabularyOverrides.end,
      ],
      set: { meaning: input.meaning.trim() },
    })
    .run();
}
