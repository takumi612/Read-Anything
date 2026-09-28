import { describe, expect, it } from "vitest";
import { buildMonthCalendar } from "@renderer/stats/month-calendar";

describe("buildMonthCalendar", () => {
  it("shows every date in the current month with Monday-first alignment", () => {
    const calendar = buildMonthCalendar([
      { day: "2026-09-01", pages: 0 },
      { day: "2026-09-24", pages: 10 },
      { day: "2026-09-25", pages: 7 },
    ]);

    expect(calendar).toHaveLength(35);
    expect(calendar[0]).toBeNull();
    expect(calendar[1]).toMatchObject({ day: "2026-09-01", pages: 0 });
    expect(calendar[24]).toMatchObject({ day: "2026-09-24", pages: 10, isFuture: false });
    expect(calendar[25]).toMatchObject({ day: "2026-09-25", pages: 7, isToday: true });
    expect(calendar[26]).toMatchObject({ day: "2026-09-26", pages: 0, isFuture: true });
    expect(calendar[30]).toMatchObject({ day: "2026-09-30", pages: 0, isFuture: true });
    expect(calendar.slice(31)).toEqual([null, null, null, null]);
  });

  it("returns no cells if the month has no reference date", () => {
    expect(buildMonthCalendar([])).toEqual([]);
  });
});
