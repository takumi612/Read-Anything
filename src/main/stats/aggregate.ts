import type { DB } from "@main/db/client";
import { dailyTotals, perBookTotals } from "@main/stats/reading-daily";
import { localDayKey } from "@main/stats/day-key";
import type { DailyPoint, ReadingStatsDto } from "@shared/stats";
import { getMonthToDatePageStreak } from "@main/stats/page-streak";

/** Số giây đọc tối thiểu để một ngày được tính vào streak và readingDays. */
export const STREAK_MIN_SECONDS = 60;

/** Cộng/trừ ngày từ YYYY-MM-DD bằng các thành phần ngày địa phương để tránh lệch múi giờ. */
function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Tổng hợp theo ngày của toàn bộ lịch sử thành DTO thống kê, chưa gồm perBook. */
export function aggregateStats(
  rows: DailyPoint[],
  dailyDays: number,
  today: string,
): Omit<ReadingStatsDto, "perBook" | "pageStreak"> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, (map.get(r.day) ?? 0) + r.seconds);
  const secondsOf = (day: string) => map.get(day) ?? 0;
  const qualifies = (day: string) => secondsOf(day) >= STREAK_MIN_SECONDS;

  let totalSeconds = 0;
  for (const v of map.values()) totalSeconds += v;

  const todaySeconds = secondsOf(today);

  let weekSeconds = 0;
  for (let i = 0; i < 7; i++) weekSeconds += secondsOf(addDays(today, -i));

  const daily: DailyPoint[] = [];
  for (let i = dailyDays - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    daily.push({ day, seconds: secondsOf(day) });
  }

  // Streak hiện tại bắt đầu ở hôm nay hoặc hôm qua nếu ngày đó đạt mục tiêu.
  let anchor: string | null = null;
  if (qualifies(today)) anchor = today;
  else if (qualifies(addDays(today, -1))) anchor = addDays(today, -1);
  let currentStreak = 0;
  for (let cur = anchor; cur != null && qualifies(cur); cur = addDays(cur, -1)) currentStreak++;

  // Streak dài nhất là chuỗi ngày đạt mục tiêu liên tiếp dài nhất trong lịch sử.
  // YYYY-MM-DD sắp theo thứ tự chữ cũng là thứ tự thời gian.
  const qualifyingDays = [...map.keys()].filter(qualifies).sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of qualifyingDays) {
    run = prev != null && addDays(prev, 1) === day ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
    prev = day;
  }

  return {
    totalSeconds,
    todaySeconds,
    weekSeconds,
    currentStreak,
    longestStreak,
    readingDays: qualifyingDays.length,
    daily,
  };
}

/** Số ngày mặc định trong trang thống kê, đồng bộ với statsGet handler. */
export const DEFAULT_DAILY_DAYS = 30;

/**
 * Dựng ReadingStatsDto từ DB đã truyền vào; dùng chung cho công cụ AI thư viện
 * và stats handler để không lặp cách tính.
 */
export function aggregateReadingStats(db: DB): ReadingStatsDto {
  const today = localDayKey(Date.now());
  const core = aggregateStats(dailyTotals(db), DEFAULT_DAILY_DAYS, today);
  return {
    ...core,
    perBook: perBookTotals(db),
    pageStreak: getMonthToDatePageStreak(db, today),
  };
}
