import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { lookupTechnicalGlossary } from "@main/vocabulary/technical-glossary";

export interface LocalDictionarySense {
  meaning: string;
  partOfSpeech: string | null;
  subPartOfSpeech: string | null;
  example: string | null;
  domain?: string;
}

export interface LocalDictionaryPronunciation {
  ipa: string;
  region: string | null;
}

export interface LocalDictionaryEntry {
  term: string;
  /** Verified dictionary headword behind the selected form; null for an exact headword. */
  baseTerm?: string | null;
  senses: LocalDictionarySense[];
  pronunciations: LocalDictionaryPronunciation[];
}

export interface LocalDictionary {
  readonly database: Database.Database;
  lookup(term: string, context?: string): LocalDictionaryEntry | null;
  close(): void;
}

interface SenseRow {
  wordId: number;
  term: string;
  meaning: string;
  partOfSpeech: string | null;
  subPartOfSpeech: string | null;
  example: string | null;
}

interface PronunciationRow {
  ipa: string;
  region: string | null;
}

const MAX_SENSES = 16;

/** Conservative regular English inflections; exact headwords always take priority. */
function inflectionCandidates(term: string): string[] {
  if (!/^[a-z]{4,}$/u.test(term)) return [];
  const candidates = new Set<string>();
  const add = (candidate: string) => {
    if (candidate.length >= 3 && candidate !== term) candidates.add(candidate);
  };
  const addDoubledConsonantStem = (stem: string) => {
    if (
      stem.length > 3 &&
      stem.at(-1) === stem.at(-2) &&
      /[b-df-hj-np-tv-z]/u.test(stem.at(-1) ?? "")
    ) {
      add(stem.slice(0, -1));
    }
  };

  if (term.endsWith("ied")) add(`${term.slice(0, -3)}y`);
  if (term.endsWith("ies")) add(`${term.slice(0, -3)}y`);
  if (term.endsWith("ization")) add(`${term.slice(0, -7)}ize`);
  if (term.endsWith("isation")) {
    add(`${term.slice(0, -7)}ise`);
    add(`${term.slice(0, -7)}ize`);
  }
  if (term.endsWith("ation")) {
    const stem = term.slice(0, -5);
    if (stem.endsWith("ic")) add(`${stem.slice(0, -2)}y`);
    add(`${stem}ate`);
  }
  if (term.endsWith("sion")) {
    const stem = term.slice(0, -4);
    add(`${stem}de`);
    add(`${stem}d`);
    add(`${stem}t`);
  }
  if (term.endsWith("ed")) {
    const stem = term.slice(0, -2);
    add(stem);
    addDoubledConsonantStem(stem);
    if (/[b-df-hj-np-tv-z]/u.test(stem.at(-1) ?? "")) add(`${stem}e`);
  }
  if (term.endsWith("ing")) {
    const stem = term.slice(0, -3);
    add(stem);
    addDoubledConsonantStem(stem);
    if (!stem.endsWith("e")) add(`${stem}e`);
  }
  if (term.endsWith("es")) {
    const stem = term.slice(0, -2);
    add(stem);
    if (/[b-df-hj-np-tv-z]/u.test(stem.at(-1) ?? "")) add(`${stem}e`);
  }
  if (term.endsWith("s")) add(term.slice(0, -1));
  return [...candidates];
}

/** Opens the bundled English→Vietnamese SQLite dictionary without permitting writes. */
export function openLocalDictionary(databasePath: string): LocalDictionary {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  const findSenses = database.prepare<[string], SenseRow>(`
    SELECT
      words.id AS wordId,
      words.word AS term,
      definitions.definition AS meaning,
      definitions.pos AS partOfSpeech,
      definitions.sub_pos AS subPartOfSpeech,
      word_definitions.example AS example
    FROM words
    JOIN word_definitions ON word_definitions.word_id = words.id
    JOIN definitions ON definitions.id = word_definitions.definition_id
    WHERE words.lang_code = 'en'
      AND words.word = ? COLLATE NOCASE
      AND definitions.definition_lang = 'vi'
    ORDER BY word_definitions.id
    LIMIT ${MAX_SENSES}
  `);
  const findPronunciations = database.prepare<[number], PronunciationRow>(`
    SELECT ipa, region
    FROM pronunciations
    WHERE word_id = ?
    ORDER BY id
    LIMIT 8
  `);

  return {
    database,
    lookup(term, context = "") {
      const normalizedTerm = term.normalize("NFC").trim().toLocaleLowerCase("en");
      if (!normalizedTerm || normalizedTerm.length > 120) return null;
      const rows = findSenses.all(normalizedTerm);
      const technicalEntry = lookupTechnicalGlossary(normalizedTerm, context);
      let baseTerm: string | null = null;
      let baseRows: SenseRow[] = [];
      let baseTechnicalEntry: ReturnType<typeof lookupTechnicalGlossary> = null;
      for (const candidate of inflectionCandidates(normalizedTerm)) {
        const candidateRows = findSenses.all(candidate);
        const candidateTechnicalEntry = lookupTechnicalGlossary(candidate, context);
        if (candidateRows[0] || candidateTechnicalEntry) {
          baseTerm = candidate;
          baseRows = candidateRows;
          baseTechnicalEntry = candidateTechnicalEntry;
          break;
        }
      }
      const firstRow = rows[0] ?? baseRows[0];
      if (!firstRow && !technicalEntry && !baseTechnicalEntry) return null;
      const generalSenses = (sourceRows: SenseRow[]): LocalDictionarySense[] =>
        sourceRows.map(({ meaning, partOfSpeech, subPartOfSpeech, example }) => ({
          meaning,
          partOfSpeech,
          subPartOfSpeech,
          example,
        }));
      const sensesFor = (
        curated: ReturnType<typeof lookupTechnicalGlossary>,
        sourceRows: SenseRow[],
      ) =>
        curated
          ? curated.includeGeneralSenses
            ? [...curated.senses, ...generalSenses(sourceRows)]
            : curated.senses
          : generalSenses(sourceRows);
      const seenSenses = new Set<string>();
      const senses = [...sensesFor(technicalEntry, rows), ...sensesFor(baseTechnicalEntry, baseRows)]
        .filter((sense) => {
          const key = [sense.domain ?? "", sense.partOfSpeech ?? "", sense.meaning]
            .join("\u0000")
            .toLocaleLowerCase("vi");
          if (seenSenses.has(key)) return false;
          seenSenses.add(key);
          return true;
        })
        .slice(0, MAX_SENSES);
      return {
        term: normalizedTerm,
        baseTerm,
        senses,
        pronunciations: firstRow ? findPronunciations.all(firstRow.wordId) : [],
      };
    },
    close: () => database.close(),
  };
}

/**
 * Copy the bundled database to writable user data before opening it read-only.
 * SQLite's source file uses WAL mode, which needs writable sidecar files even for
 * read-only queries. The versioned target also allows a future bundled update.
 */
export function installBundledDictionary(sourcePath: string, targetPath: string): string {
  if (existsSync(targetPath)) return targetPath;
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  try {
    copyFileSync(sourcePath, temporaryPath);
    try {
      renameSync(temporaryPath, targetPath);
    } catch (error) {
      // Another process may have installed the same version while this copy ran.
      if (!existsSync(targetPath)) throw error;
    }
    return targetPath;
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function resolveBundledDictionaryPath(
  isPackaged: boolean,
  appPath: string,
  resourcesPath: string,
): string {
  return isPackaged
    ? path.join(resourcesPath, "dictionary", "dictionary_en_vi.db")
    : path.join(appPath, "assets", "dictionary", "dictionary_en_vi.db");
}
