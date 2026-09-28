import type { PageDailyPoint } from "@shared/stats";

export interface MonthCalendarDay {
  day: string;
  pages: number;
  isToday: boolean;
  isFuture: boolean;
}

/** Builds a compact Monday-first calendar for the month containing the last daily point. */
export function buildMonthCalendar(daily: PageDailyPoint[]): Array<MonthCalendarDay | null> {
  const today = daily.at(-1)?.day;
  if (!today) return [];

  const first = Temporal.PlainDate.from(today).with({ day: 1 });
  const leadingCells = first.dayOfWeek - 1;
  const cellCount = Math.ceil((leadingCells + first.daysInMonth) / 7) * 7;
  const pagesByDay = new Map(daily.map((point) => [point.day, point.pages]));

  return Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - leadingCells + 1;
    if (dayNumber < 1 || dayNumber > first.daysInMonth) return null;
    const date = first.with({ day: dayNumber }).toString();
    return {
      day: date,
      pages: pagesByDay.get(date) ?? 0,
      isToday: date === today,
      isFuture: date > today,
    };
  });
}
