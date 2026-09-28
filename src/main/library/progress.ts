import { eq, sql } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { confirmedReadingPages, confirmedReadingProgress, progress } from "@main/db/schema";

export type ProgressRow = typeof progress.$inferSelect;

export function getProgress(db: DB, bookId: string): ProgressRow | undefined {
  return db.select().from(progress).where(eq(progress.bookId, bookId)).get();
}

export function saveProgress(db: DB, bookId: string, locator: string): void {
  db.insert(progress)
    .values({ bookId, locator, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: progress.bookId,
      set: { locator, updatedAt: Date.now() },
    })
    .run();
}

export type ConfirmedProgressRow = typeof confirmedReadingProgress.$inferSelect;

export function getConfirmedProgress(
  db: DB,
  bookId: string,
): ConfirmedProgressRow | undefined {
  return db
    .select()
    .from(confirmedReadingProgress)
    .where(eq(confirmedReadingProgress.bookId, bookId))
    .get();
}

export interface ConfirmedPageProgress {
  confirmedPages: number;
  percent: number;
}

export function maxProgressPercent(...values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length > 0 ? Math.max(...present) : null;
}

/** Stores each confirmed page once per book and monotonically raises confirmed completion. */
export function confirmProgressPage(
  db: DB,
  bookId: string,
  pageNumber: number,
  totalPages: number,
): ConfirmedPageProgress {
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    pageNumber > totalPages
  ) {
    throw new RangeError("pageNumber must be between 1 and totalPages");
  }
  return db.transaction((tx) => {
    tx.insert(confirmedReadingPages)
      .values({ bookId, pageNumber, confirmedAt: Date.now() })
      .onConflictDoNothing()
      .run();

    const { confirmedPages = 0 } =
      tx
        .select({ confirmedPages: sql<number>`count(*)` })
        .from(confirmedReadingPages)
        .where(eq(confirmedReadingPages.bookId, bookId))
        .get() ?? {};
    const previous = tx
      .select()
      .from(confirmedReadingProgress)
      .where(eq(confirmedReadingProgress.bookId, bookId))
      .get();
    const legacy = tx
      .select({ percent: progress.percent })
      .from(progress)
      .where(eq(progress.bookId, bookId))
      .get();
    const percent =
      maxProgressPercent(
        legacy?.percent,
        previous?.percent,
        Math.min(1, confirmedPages / totalPages),
      ) ?? 0;

    tx.insert(confirmedReadingProgress)
      .values({ bookId, totalPages, percent, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: confirmedReadingProgress.bookId,
        set: { totalPages, percent, updatedAt: Date.now() },
      })
      .run();
    return { confirmedPages, percent };
  });
}
