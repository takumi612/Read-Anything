import type { DB } from "@main/db/client";
import { readingPageVisits } from "@main/db/schema";
import type { PageDailyPoint, PageStreakDto } from "@shared/stats";
import { eq, sql } from "drizzle-orm";

export const PAGE_STREAK_GOAL = 10;

function addDays(day: string, delta: number): string {
  return Temporal.PlainDate.from(day).add({ days: delta }).toString();
}

export function aggregatePageStreak(
  rows: PageDailyPoint[],
  dailyDays: number,
  today: string,
): PageStreakDto {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.day, (totals.get(row.day) ?? 0) + Math.max(0, row.pages));
  const pagesOf = (day: string) => Math.min(PAGE_STREAK_GOAL, totals.get(day) ?? 0);
  const qualifies = (day: string) => pagesOf(day) >= PAGE_STREAK_GOAL;
  const qualifyingDays = [...totals.keys()].filter(qualifies).sort();

  let anchor: string | null = null;
  if (qualifies(today)) anchor = today;
  else if (qualifies(addDays(today, -1))) anchor = addDays(today, -1);
  let currentStreak = 0;
  for (let day = anchor; day != null && qualifies(day); day = addDays(day, -1)) currentStreak++;

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of qualifyingDays) {
    run = previous != null && addDays(previous, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const daily: PageDailyPoint[] = [];
  for (let offset = dailyDays - 1; offset >= 0; offset--) {
    const day = addDays(today, -offset);
    daily.push({ day, pages: pagesOf(day) });
  }

  return {
    goal: PAGE_STREAK_GOAL,
    pagesToday: pagesOf(today),
    currentStreak,
    longestStreak,
    readingDays: qualifyingDays.length,
    daily,
  };
}

export function pageDailyTotals(db: DB): PageDailyPoint[] {
  return db
    .select({ day: readingPageVisits.day, pages: sql<number>`count(*)` })
    .from(readingPageVisits)
    .groupBy(readingPageVisits.day)
    .orderBy(readingPageVisits.day)
    .all();
}

export function getPageStreak(db: DB, today: string, dailyDays = 7): PageStreakDto {
  return aggregatePageStreak(pageDailyTotals(db), dailyDays, today);
}

/** Month-to-date window for the stats calendar; the reader pill keeps its compact seven-day window. */
export function getMonthToDatePageStreak(db: DB, today: string): PageStreakDto {
  return getPageStreak(db, today, Temporal.PlainDate.from(today).day);
}

export function recordPageRead(
  db: DB,
  input: { bookId: string; pageNumber: number; day: string },
): PageStreakDto {
  const { pages = 0 } =
    db
      .select({ pages: sql<number>`count(*)` })
      .from(readingPageVisits)
      .where(eq(readingPageVisits.day, input.day))
      .get() ?? {};
  if (pages < PAGE_STREAK_GOAL) {
    db.insert(readingPageVisits).values(input).onConflictDoNothing().run();
  }
  return getPageStreak(db, input.day);
}
