import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createLogger } from "@renderer/logger";
import type { ProgressDto } from "@shared/library";
import type { ReadingStatsDto } from "@shared/stats";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { qk } from "@renderer/query/keys";

const log = createLogger("reader");

export const PAGE_CONFIRMATION_MS = 5_000;

interface PendingPage {
  key: string;
  pageNumber: number;
  totalPages: number;
  timer: ReturnType<typeof setTimeout>;
}

/** Confirms a PDF or estimated EPUB page after five uninterrupted seconds on that page. */
export function useRecordReadingPage(bookId: string): (pageNumber: number, totalPages: number) => void {
  const queryClient = useQueryClient();
  const setReadingPercent = useNavigationStore((state) => state.setReadingPercent);
  const lastPageKey = useRef<string | null>(null);
  const pendingPage = useRef<PendingPage | null>(null);
  const currentBookId = useRef(bookId);
  currentBookId.current = bookId;

  useEffect(() => {
    lastPageKey.current = null;
    if (pendingPage.current) clearTimeout(pendingPage.current.timer);
    pendingPage.current = null;
    return () => {
      if (pendingPage.current) clearTimeout(pendingPage.current.timer);
      pendingPage.current = null;
    };
  }, [bookId]);

  return useCallback((pageNumber: number, totalPages: number) => {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(totalPages) ||
      totalPages < 1 ||
      pageNumber > totalPages
    ) {
      return;
    }
    const day = Temporal.Now.plainDateISO().toString();
    const pageKey = `${bookId}:${day}:${pageNumber}`;
    if (lastPageKey.current === pageKey) return;
    if (pendingPage.current?.key === pageKey) {
      pendingPage.current.totalPages = totalPages;
      return;
    }
    if (pendingPage.current) clearTimeout(pendingPage.current.timer);

    const timer = setTimeout(() => {
      const pending = pendingPage.current;
      if (!pending || pending.key !== pageKey) return;
      pendingPage.current = null;
      lastPageKey.current = pageKey;
      void window.api.stats
        .recordPageRead({ bookId, pageNumber: pending.pageNumber, totalPages: pending.totalPages })
        .then((result) => {
          if (currentBookId.current !== bookId) return;
          queryClient.setQueryData(qk.pageStreak, result.pageStreak);
          queryClient.setQueriesData<ReadingStatsDto>({ queryKey: ["stats"] }, (previous) =>
            previous ? { ...previous, pageStreak: result.pageStreak } : previous,
          );
          queryClient.setQueryData<ProgressDto | null>(qk.progress(bookId), (previous) => ({
            locator: previous?.locator ?? null,
            percent: result.bookProgress.percent,
          }));
          void queryClient.invalidateQueries({ queryKey: qk.recentlyRead });
          setReadingPercent(result.bookProgress.percent);
        })
        .catch((error: unknown) => {
          if (lastPageKey.current === pageKey) lastPageKey.current = null;
          log.warn("record read page failed", error);
        });
    }, PAGE_CONFIRMATION_MS);
    pendingPage.current = { key: pageKey, pageNumber, totalPages, timer };
  }, [bookId, queryClient, setReadingPercent]);
}
