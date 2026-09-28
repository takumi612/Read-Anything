import { openPdf, pageText } from "@marginalia/pdf-parser";
import type { LoadBytes } from "@main/ai/tools";

export interface PdfEvidence {
  page: number;
  text: string;
}

interface IndexedChunk extends PdfEvidence {
  lower: string;
}

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const MAX_EVIDENCE = 6;
const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "been", "can", "does", "explain", "for", "from",
  "have", "how", "into", "its", "that", "the", "their", "these", "this", "what", "when",
  "where", "which", "with", "your", "cho", "của", "đoạn", "được", "giải", "hãy", "không",
  "nghĩa", "này", "như", "theo", "trong", "văn", "với", "toàn", "liệu", "thích",
]);

// PDF ids are hashes of their bytes. Keep at most two documents indexed in memory.
const indexCache = new Map<string, Promise<IndexedChunk[]>>();

function chunksFromPage(page: number, raw: string): IndexedChunk[] {
  const normalized = raw.replace(/\s+/gu, " ").trim();
  if (!normalized) return [];
  const out: IndexedChunk[] = [];
  for (let start = 0; start < normalized.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    const text = normalized.slice(start, start + CHUNK_SIZE);
    out.push({ page, text, lower: text.toLocaleLowerCase("en") });
    if (start + CHUNK_SIZE >= normalized.length) break;
  }
  return out;
}

async function indexPdf(bookId: string, loadBytes: LoadBytes): Promise<IndexedChunk[]> {
  const doc = await openPdf(await loadBytes(bookId));
  try {
    const out: IndexedChunk[] = [];
    for (let page = 1; page <= doc.numPages; page++) {
      out.push(...chunksFromPage(page, await pageText(doc, page)));
    }
    return out;
  } finally {
    await doc.cleanup();
    await doc.loadingTask.destroy();
  }
}

async function getIndex(bookId: string, loadBytes: LoadBytes): Promise<IndexedChunk[]> {
  let pending = indexCache.get(bookId);
  if (!pending) {
    pending = indexPdf(bookId, loadBytes);
    indexCache.set(bookId, pending);
    while (indexCache.size > 2) indexCache.delete(indexCache.keys().next().value!);
    void pending.catch(() => {
      if (indexCache.get(bookId) === pending) indexCache.delete(bookId);
    });
  }
  return pending;
}

function queryTerms(selection: string, question: string): string[] {
  const matches = `${selection} ${question}`.toLocaleLowerCase("en").match(/[\p{L}\p{N}+#.-]{3,}/gu) ?? [];
  return [...new Set(matches.filter((word) => !STOP_WORDS.has(word)))].slice(0, 32);
}

/** Local lexical retrieval across every PDF page; no external model or API call. */
export async function retrievePdfEvidence(
  bookId: string,
  loadBytes: LoadBytes,
  selection: string,
  question: string,
  currentPage?: number,
): Promise<PdfEvidence[]> {
  const chunks = await getIndex(bookId, loadBytes);
  const terms = queryTerms(selection, question);
  const phrase = selection.replace(/\s+/gu, " ").trim().toLocaleLowerCase("en");
  const scored = chunks
    .map((chunk) => {
      let score = 0;
      let matched = 0;
      for (const term of terms) {
        if (chunk.lower.includes(term)) {
          matched++;
          score += term.length > 6 ? 2 : 1;
        }
      }
      if (phrase.length >= 8 && chunk.lower.includes(phrase)) score += 20;
      if (chunk.page === currentPage && score > 0) score += 2;
      if (matched >= 2) score += matched * 2;
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.page - b.chunk.page);

  const selected: PdfEvidence[] = [];
  const pages = new Set<number>();
  for (const { chunk } of scored) {
    if (pages.has(chunk.page)) continue;
    selected.push({ page: chunk.page, text: chunk.text });
    pages.add(chunk.page);
    if (selected.length === MAX_EVIDENCE) break;
  }
  if (currentPage && !pages.has(currentPage)) {
    const current = chunks.find((chunk) => chunk.page === currentPage);
    if (current) {
      if (selected.length === MAX_EVIDENCE) selected.pop();
      selected.push({ page: current.page, text: current.text });
    }
  }
  return selected.sort((a, b) => a.page - b.page);
}

export function formatPdfEvidence(evidence: PdfEvidence[]): string | null {
  if (evidence.length === 0) return null;
  return `## Relevant excerpts retrieved from the PDF\n${evidence
    .map(({ page, text }) => `[p.${page}] ${text}`)
    .join("\n\n")}`;
}
