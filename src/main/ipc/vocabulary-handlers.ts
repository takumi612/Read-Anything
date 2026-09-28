import { C } from "@shared/ipc";
import { getDb } from "@main/db/instance";
import { bind, register, type Binding } from "@main/ipc/registry";
import { getLocalDictionary } from "@main/vocabulary/dictionary-store";
import { appService } from "@main/app";
import { readBookFile } from "@main/library/book-files";
import { getBook } from "@main/library/repository";
import { openPdf, pageText } from "@marginalia/pdf-parser";
import {
  deleteVocabulary,
  listVocabulary,
  lookupVocabulary,
  refreshVocabulary,
  saveVocabularyPhrase,
  setVocabularyOccurrence,
  updateVocabulary,
} from "@main/vocabulary/repository";

export const vocabularyBindings: Binding[] = [
  bind(C.vocabularyList, (input) => listVocabulary(getDb(), input.bookId)),
  bind(C.vocabularyCountOccurrences, async ({ bookId }) => {
    const db = getDb();
    const book = getBook(db, bookId);
    const entries = listVocabulary(db, bookId);
    const counts = Object.fromEntries(entries.map((entry) => [entry.id, 0])) as Record<
      string,
      number
    >;
    if (book?.format !== "pdf" || entries.length === 0) return counts;
    const bytes = await readBookFile(appService.getPath("booksDir"), bookId, "pdf");
    const doc = await openPdf(bytes);
    try {
      const patterns = entries.map((entry) => ({
        id: entry.id,
        regex: new RegExp(
          `(?<![\\p{L}\\p{N}])${entry.normalizedTerm
            .split(" ")
            .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+")}(?![\\p{L}\\p{N}])`,
          "giu",
        ),
      }));
      for (let page = 1; page <= doc.numPages; page++) {
        const text = await pageText(doc, page);
        for (const { id, regex } of patterns) counts[id] += [...text.matchAll(regex)].length;
      }
      return counts;
    } finally {
      await doc.cleanup();
      await doc.loadingTask.destroy();
    }
  }),
  bind(C.vocabularyLookup, (input) => lookupVocabulary(getDb(), input, getLocalDictionary())),
  bind(C.vocabularySavePhrase, (input) => saveVocabularyPhrase(getDb(), input)),
  bind(C.vocabularyUpdate, (input) => updateVocabulary(getDb(), input.id, input.meaning)),
  bind(C.vocabularyDelete, (input) => deleteVocabulary(getDb(), input.id)),
  bind(C.vocabularyRefresh, (input) => refreshVocabulary(getDb(), input.id, getLocalDictionary())),
  bind(C.vocabularySetOccurrence, (input) => setVocabularyOccurrence(getDb(), input)),
];

export function registerVocabularyHandlers(): void {
  register(vocabularyBindings);
}
