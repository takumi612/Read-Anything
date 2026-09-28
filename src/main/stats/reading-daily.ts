import { desc, eq, sql } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { books, readingDaily } from "@main/db/schema";
import type { BookReadingTotal, DailyPoint } from "@shared/stats";

export interface AddReadingSecondsInput {
  bookId: string;
  readingSessionId: string;
  day: string;
  seconds: number;
}

/** Cộng số giây đọc cho sách trong ngày địa phương; bỏ giá trị không dương. */
export function addSeconds(db: DB, input: AddReadingSecondsInput): void {
  if (input.seconds <= 0) return;
  db.insert(readingDaily)
    .values(input)
    .onConflictDoUpdate({
      target: [readingDaily.readingSessionId, readingDaily.day],
      targetWhere: sql`${readingDaily.readingSessionId} is not null`,
      set: { seconds: sql`${readingDaily.seconds} + ${input.seconds}` },
    })
    .run();
}

/** Tổng thời gian mỗi ngày của mọi sách, gồm sách đã xóa; sắp ngày tăng dần. */
export function dailyTotals(db: DB): DailyPoint[] {
  return db
    .select({ day: readingDaily.day, seconds: sql<number>`sum(${readingDaily.seconds})` })
    .from(readingDaily)
    .groupBy(readingDaily.day)
    .orderBy(readingDaily.day)
    .all();
}

/** Tổng theo sách còn trong thư viện, sắp theo giây giảm dần. */
export function perBookTotals(db: DB): BookReadingTotal[] {
  return db
    .select({
      bookId: books.id,
      title: books.title,
      author: books.author,
      seconds: sql<number>`sum(${readingDaily.seconds})`,
    })
    .from(readingDaily)
    .innerJoin(books, eq(readingDaily.bookId, books.id))
    .groupBy(books.id)
    .orderBy(desc(sql`sum(${readingDaily.seconds})`))
    .all();
}
