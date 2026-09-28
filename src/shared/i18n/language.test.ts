import { describe, expect, it } from "vitest";
import {
  LANGS,
  matchSystemLanguage,
  resolveInitialLanguage,
  uiLanguage,
} from "@shared/i18n/language";

describe("uiLanguage / LANGS", () => {
  it("enum covers exactly vi + en, all ltr", () => {
    expect(uiLanguage.options).toEqual(["vi", "en"]);
    expect(LANGS.map((l) => l.code).sort()).toEqual(["en", "vi"]);
    expect(LANGS.every((l) => l.dir === "ltr")).toBe(true);
  });
});

describe("matchSystemLanguage", () => {
  it("maps Vietnamese locales to vi, else en", () => {
    for (const loc of ["vi", "vi-VN", "VI-vn", "vi-Latn-VN"]) {
      expect(matchSystemLanguage(loc)).toBe("vi");
    }
    for (const loc of ["en", "en-US", "zh-CN", "de", "fr-FR", ""]) {
      expect(matchSystemLanguage(loc)).toBe("en");
    }
  });
});

describe("resolveInitialLanguage", () => {
  it("prefers stored, falls back to system match", () => {
    expect(resolveInitialLanguage("en", "vi-VN")).toBe("en");
    expect(resolveInitialLanguage(undefined, "vi-VN")).toBe("vi");
    expect(resolveInitialLanguage(undefined, "fr")).toBe("en");
  });
});
