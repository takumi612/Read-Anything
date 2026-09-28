import { describe, expect, it } from "vitest";
import { aggregatePageStreak } from "@main/stats/page-streak";

describe("aggregatePageStreak", () => {
  const today = "2026-09-25";

  it("lights the day at ten distinct pages and leaves nine unlit", () => {
    const nine = aggregatePageStreak([{ day: today, pages: 9 }], 7, today);
    const ten = aggregatePageStreak([{ day: today, pages: 10 }], 7, today);

    expect(nine.pagesToday).toBe(9);
    expect(nine.currentStreak).toBe(0);
    expect(ten.pagesToday).toBe(10);
    expect(ten.currentStreak).toBe(1);
  });

  it("caps flame progress at the ten-page goal", () => {
    const streak = aggregatePageStreak([{ day: today, pages: 58 }], 7, today);

    expect(streak.pagesToday).toBe(10);
    expect(streak.daily.at(-1)?.pages).toBe(10);
  });

  it("keeps the streak alive through yesterday and breaks across a missed day", () => {
    const alive = aggregatePageStreak(
      [
        { day: "2026-09-24", pages: 10 },
        { day: "2026-09-23", pages: 10 },
      ],
      7,
      today,
    );
    const broken = aggregatePageStreak(
      [
        { day: "2026-09-23", pages: 10 },
        { day: "2026-09-21", pages: 10 },
      ],
      7,
      today,
    );

    expect(alive.currentStreak).toBe(2);
    expect(broken.currentStreak).toBe(0);
    expect(alive.pagesToday).toBe(0);
  });

  it("returns zero-filled recent days and the all-time longest streak", () => {
    const streak = aggregatePageStreak(
      [
        { day: "2026-09-20", pages: 10 },
        { day: "2026-09-21", pages: 11 },
        { day: "2026-09-22", pages: 14 },
        { day: "2026-09-24", pages: 10 },
      ],
      3,
      today,
    );

    expect(streak.longestStreak).toBe(3);
    expect(streak.readingDays).toBe(4);
    expect(streak.daily).toEqual([
      { day: "2026-09-23", pages: 0 },
      { day: "2026-09-24", pages: 10 },
      { day: today, pages: 0 },
    ]);
  });
});
