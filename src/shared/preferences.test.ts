import { describe, expect, it } from "vitest";
import {
  PREFERENCE_SCHEMAS,
  appBackgroundColor,
  appBackgroundMode,
  preferenceKey,
  readerColorMode,
  readerLayoutSchema,
  readerPrefsSchema,
  setPreferenceInput,
} from "@shared/preferences";

describe("preferences schemas", () => {
  it("readerPrefsSchema requires all three numeric fields", () => {
    expect(
      readerPrefsSchema.safeParse({ fontScale: 1, lineHeight: 1.9, maxWidth: 640 }).success,
    ).toBe(true);
    expect(readerPrefsSchema.safeParse({ fontScale: 1, lineHeight: 1.9 }).success).toBe(false);
    expect(
      readerPrefsSchema.safeParse({ fontScale: 1, lineHeight: 1.9, maxWidth: 6.5 }).success,
    ).toBe(false); // maxWidth 须整数
  });

  it("registers exactly the keys with current consumers", () => {
    expect(Object.keys(PREFERENCE_SCHEMAS).sort()).toEqual([
      "aiDataConsent",
      "annotationColors",
      "annotationPalette",
      "appBackgroundBlobId",
      "appBackgroundColor",
      "appBackgroundMode",
      "autoSummarize",
      "avatarBlobId",
      "backgroundConcurrency",
      "chatModel",
      "colorMode",
      "epubColorMode",
      "instructions",
      "language",
      "lastHighlightStyle",
      "memoryAutoConsolidate",
      "memoryEnabled",
      "onboardingDismissed",
      "pdfBrightness",
      "pdfColorMode",
      "pdfSurroundingBackground",
      "pdfSurroundingBrightness",
      "pdfZoom",
      "readerLayout",
      "readerPrefs",
      "restorePdfTabs",
      "showAgentAvatar",
      "soul",
      "stepLimit",
      "summaryModel",
      "ttsPrefs",
      "webSearch",
      "webSearchEnabled",
    ]);
  });

  it("preferenceKey accepts known keys and rejects unknown", () => {
    expect(preferenceKey.safeParse("readerPrefs").success).toBe(true);
    expect(preferenceKey.safeParse("colorMode").success).toBe(true);
    expect(preferenceKey.safeParse("nope").success).toBe(false);
  });

  it("readerLayoutSchema stores sidebar and panel while ignoring the retired header flag", () => {
    expect(readerLayoutSchema.parse({ sidebarOpen: true, panelOpen: false })).toEqual({
      sidebarOpen: true,
      panelOpen: false,
    });
    expect(
      readerLayoutSchema.parse({ sidebarOpen: true, panelOpen: false, headerOpen: false }),
    ).toEqual({ sidebarOpen: true, panelOpen: false });
    expect(readerLayoutSchema.safeParse({ sidebarOpen: true, panelOpen: false }).success).toBe(
      true,
    );
    expect(readerLayoutSchema.safeParse({ sidebarOpen: 1, panelOpen: false }).success).toBe(false);
  });

  it("lastHighlightStyle validates against the annotation style enum", () => {
    expect(PREFERENCE_SCHEMAS.lastHighlightStyle.safeParse("yellow").success).toBe(true);
    expect(PREFERENCE_SCHEMAS.lastHighlightStyle.safeParse("#FB923C").success).toBe(true);
    expect(PREFERENCE_SCHEMAS.lastHighlightStyle.safeParse("teal").success).toBe(false);
  });

  it("annotationColors stores an independent library of unique fill colors", () => {
    expect(
      PREFERENCE_SCHEMAS.annotationColors.safeParse([
        "yellow",
        "green",
        "blue",
        "pink",
        "purple",
        "#FB923C",
        "#14b8a6",
      ]).success,
    ).toBe(true);
    expect(PREFERENCE_SCHEMAS.annotationColors.safeParse([]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.annotationColors.safeParse(["#abc"]).success).toBe(false);
  });

  it("annotationPalette stores unique toolbar colors independently from library size", () => {
    expect(
      PREFERENCE_SCHEMAS.annotationPalette.safeParse([
        "yellow",
        "green",
        "blue",
        "pink",
        "purple",
        "#FB923C",
      ]).success,
    ).toBe(true);
    expect(PREFERENCE_SCHEMAS.annotationPalette.safeParse([]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.annotationPalette.safeParse(["yellow", "yellow"]).success).toBe(
      false,
    );
    expect(
      PREFERENCE_SCHEMAS.annotationPalette.safeParse([
        "yellow",
        "green",
        "blue",
        "pink",
        "purple",
        "#fb923c",
        "#60a5fa",
      ]).success,
    ).toBe(true);
    expect(PREFERENCE_SCHEMAS.annotationPalette.safeParse(["#abc"]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.annotationPalette.safeParse(["underline"]).success).toBe(false);
  });

  it("setPreferenceInput covers exactly the registered keys (no drift)", () => {
    const unionKeys = setPreferenceInput.options.map((o) => o.shape.key.value).sort();
    expect(unionKeys).toEqual(Object.keys(PREFERENCE_SCHEMAS).sort());
  });

  it("setPreferenceInput validates value per key at the boundary", () => {
    expect(
      setPreferenceInput.safeParse({ key: "annotationColors", value: ["yellow", "#123456"] })
        .success,
    ).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "autoSummarize", value: true }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "autoSummarize", value: "yes" }).success).toBe(
      false,
    );
    expect(setPreferenceInput.safeParse({ key: "colorMode", value: "dark" }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "colorMode", value: "sepia" }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "pdfColorMode", value: "dark" }).success).toBe(true);
    const pdfBackground = {
      colors: [
        { id: "sage", name: "Soft sage", color: "#e4ece3", showInThemeMenu: true },
      ],
      selectedId: "sage",
    };
    expect(
      setPreferenceInput.safeParse({ key: "pdfSurroundingBackground", value: pdfBackground })
        .success,
    ).toBe(true);
    expect(
      setPreferenceInput.safeParse({
        key: "pdfSurroundingBackground",
        value: { ...pdfBackground, selectedId: "missing" },
      }).success,
    ).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "pdfBrightness", value: 100 }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "pdfBrightness", value: 151 }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "pdfBrightness", value: 49 }).success).toBe(false);
    expect(
      setPreferenceInput.safeParse({ key: "pdfSurroundingBrightness", value: 100 }).success,
    ).toBe(true);
    expect(
      setPreferenceInput.safeParse({ key: "pdfSurroundingBrightness", value: 151 }).success,
    ).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "epubColorMode", value: "dark" }).success).toBe(
      true,
    );
    expect(readerColorMode.safeParse("sepia").success).toBe(true);
    expect(readerColorMode.safeParse("sage").success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "epubColorMode", value: "sepia" }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "pdfColorMode", value: "sage" }).success).toBe(true);
    expect(appBackgroundMode.safeParse("image").success).toBe(true);
    expect(appBackgroundColor.safeParse("#9caabb").success).toBe(true);
    expect(appBackgroundColor.safeParse("not-a-color").success).toBe(false);
    expect(
      setPreferenceInput.safeParse({ key: "readerPrefs", value: { fontScale: 1 } }).success,
    ).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "unknownKey", value: 1 }).success).toBe(false);
    expect(
      setPreferenceInput.safeParse({
        key: "readerLayout",
        value: { sidebarOpen: true, panelOpen: false, headerOpen: true },
      }).success,
    ).toBe(true);
    expect(
      setPreferenceInput.safeParse({ key: "readerLayout", value: { sidebarOpen: true } }).success,
    ).toBe(false);
    expect(
      setPreferenceInput.safeParse({
        key: "summaryModel",
        value: { providerId: "p1", model: "m" },
      }).success,
    ).toBe(true);
    expect(
      setPreferenceInput.safeParse({
        key: "summaryModel",
        value: { providerId: "", model: "m" },
      }).success,
    ).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "pdfZoom", value: 1.25 }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "pdfZoom", value: 0 }).success).toBe(false); // 须为正数
    expect(setPreferenceInput.safeParse({ key: "pdfZoom", value: "1.25" }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "onboardingDismissed", value: true }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "onboardingDismissed", value: "yes" }).success).toBe(
      false,
    );
  });

  it("readerPrefs 旧 JSON(无 fontFamily)parse 成功且默认 default", () => {
    const parsed = readerPrefsSchema.parse({ fontScale: 1, lineHeight: 1.9, maxWidth: 640 });
    expect(parsed.fontFamily).toBe("default");
  });

  it("fontFamily 接受四档枚举、拒绝未知值", () => {
    const base = { fontScale: 1, lineHeight: 1.9, maxWidth: 640 };
    for (const v of ["default", "wenkai", "serif", "sans"]) {
      expect(readerPrefsSchema.safeParse({ ...base, fontFamily: v }).success).toBe(true);
    }
    expect(readerPrefsSchema.safeParse({ ...base, fontFamily: "comic-sans" }).success).toBe(false);
  });
});

describe("stepLimit preference", () => {
  it("accepts 0 (unlimited) and positive ints, rejects negatives/floats", () => {
    expect(setPreferenceInput.safeParse({ key: "stepLimit", value: 0 }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "stepLimit", value: 10 }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "stepLimit", value: -1 }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "stepLimit", value: 3.5 }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "stepLimit", value: "5" }).success).toBe(false);
  });
});

describe("language preference", () => {
  it("preferenceKey includes language", () => {
    expect(preferenceKey.options).toContain("language");
  });
  it("setPreferenceInput accepts a valid language, rejects junk", () => {
    expect(setPreferenceInput.safeParse({ key: "language", value: "en" }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "language", value: "vi" }).success).toBe(true);
    expect(setPreferenceInput.safeParse({ key: "language", value: "zh-CN" }).success).toBe(false);
    expect(setPreferenceInput.safeParse({ key: "language", value: "fr" }).success).toBe(false);
  });
});

describe("backgroundConcurrency preference", () => {
  it("accepts positive ints, rejects 0/negatives/floats/strings", () => {
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: 3 }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: 1 }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: 0 }).success).toBe(
      false,
    );
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: -1 }).success).toBe(
      false,
    );
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: 2.5 }).success).toBe(
      false,
    );
    expect(setPreferenceInput.safeParse({ key: "backgroundConcurrency", value: "3" }).success).toBe(
      false,
    );
  });
});

describe("ttsPrefs preference", () => {
  it("ttsPrefs accepts rate + voiceByLang and rejects out-of-range rate", () => {
    const schema = PREFERENCE_SCHEMAS.ttsPrefs;
    expect(schema.safeParse({ rate: 1, voiceByLang: {} }).success).toBe(true);
    expect(schema.safeParse({ rate: 1.5, voiceByLang: { zh: "Tingting" } }).success).toBe(true);
    expect(schema.safeParse({ rate: 3, voiceByLang: {} }).success).toBe(false);
    expect(schema.safeParse({ rate: 0.1, voiceByLang: {} }).success).toBe(false);
  });
});

describe("webSearch preference", () => {
  it("is registered in PREFERENCE_SCHEMAS", () => {
    expect("webSearch" in PREFERENCE_SCHEMAS).toBe(true);
  });
  it("validates a set payload (backends-only, no enabled field)", () => {
    const r = setPreferenceInput.safeParse({
      key: "webSearch",
      value: { backends: [{ kind: "exa-mcp", apiKey: "sk" }] },
    });
    expect(r.success).toBe(true);
  });
  it("back-compat: old stored { enabled, backends } still parses (enabled stripped)", () => {
    const r = setPreferenceInput.safeParse({
      key: "webSearch",
      value: { enabled: true, backends: [{ kind: "exa-mcp" }] },
    });
    expect(r.success).toBe(true);
  });
});

describe("webSearchEnabled preference", () => {
  it("is registered in PREFERENCE_SCHEMAS", () => {
    expect("webSearchEnabled" in PREFERENCE_SCHEMAS).toBe(true);
  });
  it("setPreferenceInput accepts boolean values", () => {
    expect(setPreferenceInput.safeParse({ key: "webSearchEnabled", value: true }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "webSearchEnabled", value: false }).success).toBe(
      true,
    );
    expect(setPreferenceInput.safeParse({ key: "webSearchEnabled", value: "yes" }).success).toBe(
      false,
    );
  });
});

describe("reasoningEffort on chatModel / summaryModel", () => {
  for (const key of ["chatModel", "summaryModel"] as const) {
    it(`${key} accepts optional reasoningEffort none/low/medium/high`, () => {
      for (const effort of ["none", "low", "medium", "high"]) {
        const r = setPreferenceInput.safeParse({
          key,
          value: { providerId: "p1", model: "m", reasoningEffort: effort },
        });
        expect(r.success).toBe(true);
        if (r.success)
          expect((r.data.value as { reasoningEffort?: string }).reasoningEffort).toBe(effort);
      }
    });

    it(`${key} rejects out-of-range reasoningEffort (max/xhigh/minimal/junk)`, () => {
      for (const bad of ["max", "xhigh", "minimal", "provider-default", ""]) {
        expect(
          setPreferenceInput.safeParse({
            key,
            value: { providerId: "p1", model: "m", reasoningEffort: bad },
          }).success,
        ).toBe(false);
      }
    });

    it(`${key} back-compat: old { providerId, model } parses, reasoningEffort undefined`, () => {
      const r = setPreferenceInput.safeParse({ key, value: { providerId: "p1", model: "m" } });
      expect(r.success).toBe(true);
      if (r.success)
        expect((r.data.value as { reasoningEffort?: string }).reasoningEffort).toBeUndefined();
    });
  }
});
