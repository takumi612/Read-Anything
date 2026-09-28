import { describe, expect, it } from "vitest";
import { readerThemeCss, readerThemeCssForMode } from "@renderer/reader/reader-theme-css";

describe("readerThemeCss", () => {
  it("returns empty string for light (keep ePub paper styling)", () => {
    expect(readerThemeCss(false)).toBe("");
  });

  it("returns dark overrides for dark", () => {
    const css = readerThemeCss(true);
    expect(css).toContain("background-color: #15181c");
    expect(css).toContain("color: #c9cdd1");
    expect(css).toContain("!important");
    expect(css).toContain("img { filter: brightness(0.9); }");
  });

  it("resolves EPUB page colors independently of the application theme", () => {
    expect(readerThemeCssForMode("light", "dark")).toBe("");
    expect(readerThemeCssForMode("dark", "light")).toContain("background-color: #15181c");
    expect(readerThemeCssForMode("system", "dark")).toContain("background-color: #15181c");
    expect(readerThemeCssForMode("system", "light")).toBe("");
  });

  it("applies a warm paper theme to EPUB pages", () => {
    const css = readerThemeCssForMode("paper", "light");
    expect(css).toContain("background-color: #fffaf0");
    expect(css).toContain("color: #29261f");
  });

  it("applies sepia and soft green themes without changing the OS theme", () => {
    expect(readerThemeCssForMode("sepia", "dark")).toContain("background-color: #efe5ce");
    expect(readerThemeCssForMode("sage", "dark")).toContain("background-color: #e7efe8");
  });
});
