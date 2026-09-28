export interface PdfSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export const DEFAULT_PDF_SEARCH_OPTIONS: PdfSearchOptions = {
  caseSensitive: false,
  wholeWord: true,
};

export interface PdfTextMatch {
  start: number;
  end: number;
  snippet: string;
}

export interface PdfSearchResult extends PdfTextMatch {
  page: number;
  ordinal: number;
}

export interface PdfSearchSnippetPart {
  text: string;
  match: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createSearchExpression(query: string, options: PdfSearchOptions): RegExp | undefined {
  const words = query.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return undefined;
  const term = words.map(escapeRegex).join("\\s+");
  const source = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${term}(?![\\p{L}\\p{N}_])` : term;
  return new RegExp(source, options.caseSensitive ? "gu" : "giu");
}

export function splitPdfSearchSnippet(
  snippet: string,
  query: string,
  options: PdfSearchOptions,
): PdfSearchSnippetPart[] {
  const expression = createSearchExpression(query, options);
  if (!expression) return [{ text: snippet, match: false }];

  const parts: PdfSearchSnippetPart[] = [];
  let lastIndex = 0;
  for (const match of snippet.matchAll(expression)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push({ text: snippet.slice(lastIndex, start), match: false });
    parts.push({ text: match[0], match: true });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < snippet.length) {
    parts.push({ text: snippet.slice(lastIndex), match: false });
  }
  return parts.length > 0 ? parts : [{ text: snippet, match: false }];
}

export function findPdfTextMatches(
  text: string,
  query: string,
  options: PdfSearchOptions,
  snippetText = text,
): PdfTextMatch[] {
  const expression = createSearchExpression(query, options);
  if (!expression) return [];
  const rawMatches = [...text.matchAll(expression)];
  const snippetMatches =
    snippetText === text
      ? rawMatches
      : [...snippetText.matchAll(new RegExp(expression.source, expression.flags))];
  const matches: PdfTextMatch[] = [];
  for (const [ordinal, match] of rawMatches.entries()) {
    const start = match.index;
    const end = start + match[0].length;
    const readableMatch =
      snippetMatches.length === rawMatches.length ? snippetMatches[ordinal] : undefined;
    const sourceText = readableMatch ? snippetText : text;
    const snippetStart = readableMatch?.index ?? start;
    const snippetEnd = snippetStart + (readableMatch?.[0].length ?? match[0].length);
    const from = Math.max(0, snippetStart - 44);
    const to = Math.min(sourceText.length, snippetEnd + 56);
    const snippet = `${from > 0 ? "…" : ""}${sourceText.slice(from, to).replace(/\s+/gu, " ")}${to < sourceText.length ? "…" : ""}`;
    matches.push({ start, end, snippet });
  }
  return matches;
}
