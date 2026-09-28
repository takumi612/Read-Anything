import { C } from "@shared/ipc";
import type { ReadingStatsDto } from "@shared/stats";
import { getDb } from "@main/db/instance";
import { aggregateStats, aggregateReadingStats } from "@main/stats/aggregate";
import { localDayKey } from "@main/stats/day-key";
import { dailyTotals, perBookTotals } from "@main/stats/reading-daily";
import { getMonthToDatePageStreak, getPageStreak, recordPageRead } from "@main/stats/page-streak";
import { books } from "@main/db/schema";
import { eq } from "drizzle-orm";
import { getReadingClock } from "@main/stats/clock-wiring";
import { getActiveReadingSession } from "@main/reading-sessions/repository";
import { confirmProgressPage } from "@main/library/progress";
import { bind, register, type Binding } from "@main/ipc/registry";

export const statsBindings: Binding[] = [
  bind(C.statsReadingState, (input) => {
    if (input.status === "idle") return getReadingClock().setReadingBook(null);
    if (!getActiveReadingSession(getDb(), input.bookId))
      throw new Error(`stats:reading-state — book ${input.bookId} has no active reading session`);
    getReadingClock().setReadingBook(input.bookId);
  }),
  bind(C.statsGet, (input): ReadingStatsDto => {
    const db = getDb();
    const today = localDayKey(Date.now());
    // Thiếu dailyDays thì dùng 30 ngày mặc định; có giá trị thì lấy khoảng tùy chọn.
    if (input.dailyDays == null) return aggregateReadingStats(db);
    const core = aggregateStats(dailyTotals(db), input.dailyDays, today);
    return {
      ...core,
      perBook: perBookTotals(db),
      pageStreak: getMonthToDatePageStreak(db, today),
    };
  }),
  bind(C.statsPageStreakGet, () => getPageStreak(getDb(), localDayKey(Date.now()))),
  bind(C.statsRecordPageRead, (input) => {
    const db = getDb();
    const book = db
      .select({ format: books.format })
      .from(books)
      .where(eq(books.id, input.bookId))
      .get();
    if (!book || (book.format !== "pdf" && book.format !== "epub"))
      throw new Error(`stats:record-page-read — unsupported book ${input.bookId}`);
    if (
      !Number.isInteger(input.pageNumber) ||
      input.pageNumber < 1 ||
      !Number.isInteger(input.totalPages) ||
      input.totalPages < 1 ||
      input.pageNumber > input.totalPages
    ) {
      throw new RangeError("pageNumber must be between 1 and totalPages");
    }
    const pageStreak = recordPageRead(db, { ...input, day: localDayKey(Date.now()) });
    const bookProgress = confirmProgressPage(db, input.bookId, input.pageNumber, input.totalPages);
    return { pageStreak, bookProgress };
  }),
];

export function registerStatsHandlers(): void {
  register(statsBindings);
}
