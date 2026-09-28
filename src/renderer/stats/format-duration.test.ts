import { describe, expect, it } from "vitest";
import { formatDuration } from "@renderer/stats/format-duration";

describe("formatDuration", () => {
  const f = (s: number) => formatDuration(s, "hr", "min");
  it("formats sub-hour as minutes", () => {
    expect(f(2820)).toBe("47 min"); // 47:00
    expect(f(60)).toBe("1 min");
  });
  it("floors sub-minute to 0m", () => {
    expect(f(0)).toBe("0 min");
    expect(f(59)).toBe("0 min");
  });
  it("omits minutes when whole hours", () => {
    expect(f(3600)).toBe("1 hr");
    expect(f(7200)).toBe("2 hr");
  });
  it("shows hours and minutes", () => {
    expect(f(4320)).toBe("1 hr 12 min"); // 72m
    expect(f(7320)).toBe("2 hr 2 min");
  });
  it("clamps negatives to 0m", () => {
    expect(f(-10)).toBe("0 min");
  });
});
