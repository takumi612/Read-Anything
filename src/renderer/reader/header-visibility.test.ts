import { describe, expect, it } from "vitest";
import {
  hasRecentUserScrollIntent,
  isReadingScrollWheel,
  nextHeaderVisibility,
} from "./header-visibility";

describe("hasRecentUserScrollIntent", () => {
  it("accepts user scrolling while ignoring stale scroll restoration", () => {
    expect(hasRecentUserScrollIntent(1000, 1500)).toBe(true);
    expect(hasRecentUserScrollIntent(1000, 1900)).toBe(false);
  });
});

describe("isReadingScrollWheel", () => {
  it("accepts an unmodified wheel as reading scroll input", () => {
    expect(isReadingScrollWheel({ ctrlKey: false, metaKey: false })).toBe(true);
  });

  it("ignores Ctrl/Meta wheel gestures used for pinch zoom", () => {
    expect(isReadingScrollWheel({ ctrlKey: true, metaKey: false })).toBe(false);
    expect(isReadingScrollWheel({ ctrlKey: false, metaKey: true })).toBe(false);
  });
});

describe("nextHeaderVisibility", () => {
  it("keeps the header visible at the top of the document", () => {
    expect(nextHeaderVisibility(false, 4, 0)).toBe(true);
  });

  it("hides the header while the reader scrolls down", () => {
    expect(nextHeaderVisibility(true, 120, 160)).toBe(false);
  });

  it("shows the header while the reader scrolls up", () => {
    expect(nextHeaderVisibility(false, 160, 120)).toBe(true);
  });

  it("ignores small scroll jitter", () => {
    expect(nextHeaderVisibility(true, 120, 121)).toBe(true);
    expect(nextHeaderVisibility(false, 120, 121)).toBe(false);
  });

  it("ignores layout scroll in the opposite direction of the user's gesture", () => {
    expect(nextHeaderVisibility(false, 150, 110, 1)).toBe(false);
    expect(nextHeaderVisibility(true, 110, 150, -1)).toBe(true);
  });
});
