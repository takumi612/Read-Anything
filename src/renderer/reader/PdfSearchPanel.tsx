import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import type { PdfBook } from "./pdf-book";
import {
  findPdfTextMatches,
  splitPdfSearchSnippet,
  type PdfSearchOptions,
  type PdfSearchResult,
} from "./pdf-search";

interface Props {
  book: PdfBook;
  query: string;
  options: PdfSearchOptions;
  onQueryChange: (query: string) => void;
  onOptionsChange: (options: PdfSearchOptions) => void;
  onJump: (result: PdfSearchResult) => void;
  onClose: () => void;
}

export function PdfSearchPanel({
  book,
  query,
  options,
  onQueryChange,
  onOptionsChange,
  onJump,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [results, setResults] = useState<PdfSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchedPages, setSearchedPages] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    const onFind = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onFind);
    return () => window.removeEventListener("keydown", onFind);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel || !(event.target instanceof Node) || panel.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  useEffect(() => {
    setResults([]);
    setActiveIndex(-1);
    setSearchedPages(0);
    setError(false);
    if (!query.trim()) {
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const found: PdfSearchResult[] = [];
        try {
          for (let page = 1; page <= book.pageCount; page++) {
            if (cancelled) return;
            const pageText = await book.readPageText(page);
            if (cancelled) return;
            const pageMatches = findPdfTextMatches(
              pageText.text,
              query,
              options,
              pageText.snippetText,
            );
            for (const [ordinal, match] of pageMatches.entries()) {
              found.push({ ...match, page, ordinal });
            }
            if (page % 8 === 0 || page === book.pageCount) {
              setResults([...found]);
              setSearchedPages(page);
            }
          }
          setSearching(false);
        } catch {
          if (!cancelled) {
            setError(true);
            setSearching(false);
          }
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [book, query, options]);

  const jumpTo = (index: number) => {
    const result = results[index];
    if (!result) return;
    setActiveIndex(index);
    onJump(result);
  };
  const step = (direction: -1 | 1) => {
    if (results.length === 0) return;
    const next =
      activeIndex < 0
        ? direction > 0
          ? 0
          : results.length - 1
        : (activeIndex + direction + results.length) % results.length;
    jumpTo(next);
  };

  const firstVisible =
    results.length <= 200 || activeIndex < 0
      ? 0
      : Math.min(Math.max(activeIndex - 80, 0), results.length - 200);
  const visibleResults = results.slice(firstVisible, firstVisible + 200);

  return (
    <section
      ref={panelRef}
      className="absolute top-12 right-3 z-50 flex max-h-[min(65vh,540px)] w-[min(400px,calc(100vw-24px))] flex-col rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl"
      aria-label={t("reader.pdf.search.title")}
    >
      <div className="flex items-center gap-1">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") step(event.shiftKey ? -1 : 1);
            if (event.key === "Escape") onClose();
          }}
          placeholder={t("reader.pdf.search.placeholder")}
          aria-label={t("reader.pdf.search.placeholder")}
          maxLength={200}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("reader.pdf.search.previous")}
          disabled={results.length === 0}
          onClick={() => step(-1)}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("reader.pdf.search.next")}
          disabled={results.length === 0}
          onClick={() => step(1)}
        >
          <ChevronDown />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={t("common.close")} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Button
          variant={options.caseSensitive ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={options.caseSensitive}
          onClick={() => onOptionsChange({ ...options, caseSensitive: !options.caseSensitive })}
        >
          {t("reader.pdf.search.caseSensitive")}
        </Button>
        <Button
          variant={options.wholeWord ? "secondary" : "ghost"}
          size="xs"
          aria-pressed={options.wholeWord}
          onClick={() => onOptionsChange({ ...options, wholeWord: !options.wholeWord })}
        >
          {t("reader.pdf.search.wholeWord")}
        </Button>
        <span className="ml-auto text-muted-foreground" role="status">
          {searching ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="size-3 animate-spin" />
              {t("reader.pdf.search.progress", { page: searchedPages, total: book.pageCount })}
            </span>
          ) : query.trim() ? (
            t("reader.pdf.search.count", { count: results.length })
          ) : null}
        </span>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{t("reader.pdf.search.error")}</p>}
      {!error && !searching && query.trim() && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t("reader.pdf.search.empty")}</p>
      )}
      {results.length > 0 && (
        <div className="mt-2 min-h-0 overflow-y-auto border-t border-border pt-1">
          {visibleResults.map((result, offset) => {
            const index = firstVisible + offset;
            return (
              <button
                key={`${result.page}-${result.ordinal}-${result.start}`}
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent data-[active=true]:bg-accent"
                data-active={index === activeIndex}
                onClick={() => jumpTo(index)}
              >
                <span className="font-medium">
                  {t("reader.pdf.search.page", { page: result.page })}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {splitPdfSearchSnippet(result.snippet, query, options).map((part, partIndex) =>
                    part.match ? (
                      <strong key={partIndex} className="font-semibold text-foreground">
                        {part.text}
                      </strong>
                    ) : (
                      <span key={partIndex}>{part.text}</span>
                    ),
                  )}
                </span>
              </button>
            );
          })}
          {results.length > visibleResults.length && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              {t("reader.pdf.search.showing", {
                first: firstVisible + 1,
                last: firstVisible + visibleResults.length,
                total: results.length,
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
