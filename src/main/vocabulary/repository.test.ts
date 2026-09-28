import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, runMigrations } from "@main/db/client";
import { books } from "@main/db/schema";
import { initMainI18n } from "@main/i18n";
import type { LocalDictionary, LocalDictionaryEntry } from "@main/vocabulary/local-dictionary";
import {
  deleteVocabulary,
  listVocabulary,
  lookupVocabulary,
  normalizeVocabularyTerm,
  setVocabularyOccurrence,
  updateVocabulary,
} from "@main/vocabulary/repository";

const MIGRATIONS = path.resolve(__dirname, "../db/migrations");

function freshDb() {
  const db = createDb(":memory:");
  runMigrations(db, MIGRATIONS);
  db.insert(books)
    .values([
      { id: "book-a", format: "pdf", pageCount: 10 },
      { id: "book-b", format: "pdf", pageCount: 10 },
    ])
    .run();
  return db;
}

const bankEntry: LocalDictionaryEntry = {
  term: "bank",
  senses: [
    {
      meaning: "ngân hàng",
      partOfSpeech: "N",
      subPartOfSpeech: "noun",
      example: "She works at a bank.",
    },
    {
      meaning: "bờ sông",
      partOfSpeech: "N",
      subPartOfSpeech: "noun",
      example: "They sat on the bank.",
    },
  ],
  pronunciations: [{ ipa: "/bæŋk/", region: "US" }],
};

function fakeDictionary(result: LocalDictionaryEntry | null) {
  const lookup = vi.fn(() => result);
  return { dictionary: { lookup } as unknown as LocalDictionary, lookup };
}

describe("vocabulary repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initMainI18n("vi");
  });

  it("normalizes Unicode, case, and whitespace before cache lookup", () => {
    expect(normalizeVocabularyTerm("  cafe\u0301   REST API ")).toBe("café rest api");
  });

  it("looks up locally and caches the result per PDF", () => {
    const db = freshDb();
    const { dictionary, lookup } = fakeDictionary(bankEntry);
    const first = lookupVocabulary(
      db,
      { bookId: "book-a", term: " Bank ", context: "A bank near the river.", sourcePage: 3 },
      dictionary,
    );
    const cached = lookupVocabulary(
      db,
      { bookId: "book-a", term: "BANK", context: "A different context.", sourcePage: 8 },
      dictionary,
    );

    expect(cached.id).toBe(first.id);
    expect(cached.meaning).toContain("ngân hàng");
    expect(cached.meaning).toContain("bờ sông");
    expect(cached.meaning).toContain("/bæŋk/ (US)");
    expect(cached.sourcePage).toBe(3);
    expect(cached.context).toBe("A bank near the river.");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenNthCalledWith(1, "bank", "A bank near the river.");

    const otherBook = lookupVocabulary(
      db,
      { bookId: "book-b", term: "bank", context: "A river bank.", sourcePage: 1 },
      dictionary,
    );
    expect(otherBook.id).not.toBe(first.id);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(listVocabulary(db, "book-a")).toHaveLength(1);
    expect(listVocabulary(db, "book-b")).toHaveLength(1);
  });

  it("labels and preserves all domain-specific senses in the saved vocabulary entry", () => {
    const db = freshDb();
    const { dictionary } = fakeDictionary({
      term: "microservices",
      senses: [
        {
          meaning: "các dịch vụ nhỏ có thể triển khai độc lập",
          partOfSpeech: "noun",
          subPartOfSpeech: "plural",
          example: "The application is split into microservices.",
          domain: "Kiến trúc phần mềm",
        },
        {
          meaning: "kiến trúc xây dựng hệ thống từ nhiều dịch vụ nhỏ giao tiếp qua mạng",
          partOfSpeech: "noun",
          subPartOfSpeech: null,
          example: null,
          domain: "Kiến trúc phần mềm",
        },
      ],
      pronunciations: [],
    });

    const entry = lookupVocabulary(
      db,
      {
        bookId: "book-a",
        term: "microservices",
        context: "The system uses microservices.",
        sourcePage: 20,
      },
      dictionary,
    );

    expect(entry.meaning).toContain("[Kiến trúc phần mềm]");
    expect(entry.meaning).toContain("1. [Kiến trúc phần mềm] [noun · plural]");
    expect(entry.meaning).toContain("2. [Kiến trúc phần mềm] [noun]");
    expect(entry.meaning).toContain("các dịch vụ nhỏ có thể triển khai độc lập");
    expect(entry.meaning).toContain("kiến trúc xây dựng hệ thống từ nhiều dịch vụ nhỏ");
  });

  it("does not save a word absent from the local dictionary", () => {
    const db = freshDb();
    const { dictionary, lookup } = fakeDictionary(null);
    const input = {
      bookId: "book-a",
      term: "microservices",
      context: "The system uses microservices.",
      sourcePage: 4,
    };

    expect(() => lookupVocabulary(db, input, dictionary)).toThrow("từ điển ngoại tuyến");
    expect(listVocabulary(db, "book-a")).toHaveLength(0);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("updates the default meaning and replaces only the selected occurrence override", () => {
    const db = freshDb();
    const { dictionary } = fakeDictionary(bankEntry);
    const entry = lookupVocabulary(
      db,
      { bookId: "book-a", term: "bank", context: "A bank near the river.", sourcePage: 2 },
      dictionary,
    );

    const updated = updateVocabulary(db, entry.id, "bờ sông");
    setVocabularyOccurrence(db, {
      entryId: entry.id,
      page: 2,
      start: 15,
      end: 19,
      meaning: "bờ sông",
    });
    setVocabularyOccurrence(db, {
      entryId: entry.id,
      page: 2,
      start: 15,
      end: 19,
      meaning: "ngân hàng",
    });

    const [listed] = listVocabulary(db, "book-a");
    expect(updated.meaning).toBe("bờ sông");
    expect(listed?.meaning).toBe("bờ sông");
    expect(listed?.overrides).toEqual([{ page: 2, start: 15, end: 19, meaning: "ngân hàng" }]);
    expect(() =>
      setVocabularyOccurrence(db, {
        entryId: entry.id,
        page: 2,
        start: 19,
        end: 19,
        meaning: "invalid",
      }),
    ).toThrow("Vị trí của từ không hợp lệ");
  });

  it("rejects invalid terms before querying the local dictionary", () => {
    const db = freshDb();
    const { dictionary, lookup } = fakeDictionary(bankEntry);

    expect(() =>
      lookupVocabulary(
        db,
        { bookId: "book-a", term: "   ", context: "", sourcePage: 1 },
        dictionary,
      ),
    ).toThrow("không hợp lệ");
    expect(() =>
      lookupVocabulary(
        db,
        { bookId: "book-a", term: "x".repeat(121), context: "", sourcePage: 1 },
        dictionary,
      ),
    ).toThrow("không hợp lệ");
    expect(lookup).not.toHaveBeenCalled();
  });

  it("deletes an entry and cascades its occurrence overrides", () => {
    const db = freshDb();
    const { dictionary } = fakeDictionary(bankEntry);
    const entry = lookupVocabulary(
      db,
      { bookId: "book-a", term: "bank", context: "A financial bank.", sourcePage: 2 },
      dictionary,
    );
    setVocabularyOccurrence(db, {
      entryId: entry.id,
      page: 2,
      start: 0,
      end: 4,
      meaning: "ngân hàng",
    });

    deleteVocabulary(db, entry.id);

    expect(listVocabulary(db, "book-a")).toHaveLength(0);
  });
});
