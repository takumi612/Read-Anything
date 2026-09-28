import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/store/persist-preference", () => ({ persistPreference: vi.fn() }));

import { persistPreference } from "@renderer/store/persist-preference";
import { usePrefsStore, PREFS_INITIAL } from "@renderer/store/prefs-store";
import {
  DEFAULT_ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_PALETTE,
  DEFAULT_STEP_LIMIT,
  DEFAULT_BACKGROUND_CONCURRENCY,
} from "@shared/preferences";

beforeEach(() => {
  usePrefsStore.setState(PREFS_INITIAL);
  vi.clearAllMocks();
});

describe("prefs-store", () => {
  it("updatePrefs merges patch, keeps other fields", () => {
    usePrefsStore.getState().updatePrefs({ fontScale: 1.2 });
    expect(usePrefsStore.getState().prefs.fontScale).toBe(1.2);
    expect(usePrefsStore.getState().prefs.maxWidth).toBe(640);
  });
  it("setLastHighlightStyle updates style", () => {
    usePrefsStore.getState().setLastHighlightStyle("blue");
    expect(usePrefsStore.getState().lastHighlightStyle).toBe("blue");
  });
  it("persists the saved highlight color library independently from toolbar colors", () => {
    const colors = ["yellow", "#123456", "#654321"] as const;
    usePrefsStore.getState().setAnnotationColors([...colors]);
    expect(usePrefsStore.getState().annotationColors).toEqual(colors);
    expect(usePrefsStore.getState().annotationPalette).toEqual(PREFS_INITIAL.annotationPalette);
    expect(persistPreference).toHaveBeenCalledWith({ key: "annotationColors", value: colors });
  });
  it("starts with the six built-in colors both saved and enabled", () => {
    expect(PREFS_INITIAL.annotationColors).toEqual(DEFAULT_ANNOTATION_COLORS);
    expect(PREFS_INITIAL.annotationPalette).toEqual(DEFAULT_ANNOTATION_PALETTE);
    expect(PREFS_INITIAL.annotationPalette).toHaveLength(6);
  });
  it("setPdfColorMode persists a PDF-only appearance choice", () => {
    usePrefsStore.getState().setPdfColorMode("dark");
    expect(usePrefsStore.getState().pdfColorMode).toBe("dark");
    expect(persistPreference).toHaveBeenCalledWith({ key: "pdfColorMode", value: "dark" });
    expect(usePrefsStore.getState().layout).toEqual(PREFS_INITIAL.layout);
  });
  it("keeps EPUB page appearance independent from PDF page appearance", () => {
    usePrefsStore.getState().setEpubColorMode("dark");
    expect(usePrefsStore.getState().epubColorMode).toBe("dark");
    expect(usePrefsStore.getState().pdfColorMode).toBe(PREFS_INITIAL.pdfColorMode);
    expect(persistPreference).toHaveBeenCalledWith({ key: "epubColorMode", value: "dark" });
  });
  it("defaults PDF pages to their original light rendering independently of app theme", () => {
    expect(PREFS_INITIAL.pdfColorMode).toBe("light");
  });
  it("persists PDF brightness independently from page colors and application theme", () => {
    usePrefsStore.getState().setPdfBrightness(125);
    expect(usePrefsStore.getState().pdfBrightness).toBe(125);
    expect(persistPreference).toHaveBeenCalledWith({ key: "pdfBrightness", value: 125 });
    expect(usePrefsStore.getState().pdfColorMode).toBe(PREFS_INITIAL.pdfColorMode);
  });
  it("persists custom PDF surrounding tones independently from app and EPUB appearance", () => {
    const background = {
      colors: [
        { id: "sage", name: "Soft sage", color: "#e4ece3", showInThemeMenu: true },
      ],
      selectedId: "sage",
    };
    usePrefsStore.getState().setPdfSurroundingBackground(background);
    expect(usePrefsStore.getState().pdfSurroundingBackground).toEqual(background);
    expect(persistPreference).toHaveBeenCalledWith({
      key: "pdfSurroundingBackground",
      value: background,
    });
    expect(usePrefsStore.getState().appBackgroundColor).toBe(PREFS_INITIAL.appBackgroundColor);
    expect(usePrefsStore.getState().epubColorMode).toBe(PREFS_INITIAL.epubColorMode);
  });
  it("persists application background choices independently from book colors", () => {
    usePrefsStore.getState().setAppBackgroundColor("#aabbcc");
    usePrefsStore.getState().setAppBackgroundMode("color");
    expect(usePrefsStore.getState().appBackgroundColor).toBe("#aabbcc");
    expect(usePrefsStore.getState().appBackgroundMode).toBe("color");
    expect(persistPreference).toHaveBeenCalledWith({
      key: "appBackgroundColor",
      value: "#aabbcc",
    });
    expect(persistPreference).toHaveBeenCalledWith({ key: "appBackgroundMode", value: "color" });
    expect(usePrefsStore.getState().epubColorMode).toBe(PREFS_INITIAL.epubColorMode);
    expect(usePrefsStore.getState().pdfColorMode).toBe(PREFS_INITIAL.pdfColorMode);
  });
  it("setAutoSummarize updates flag", () => {
    usePrefsStore.getState().setAutoSummarize(true);
    expect(usePrefsStore.getState().autoSummarize).toBe(true);
  });
  it("updateLayout merges patch, keeps other flags, persists whole object", () => {
    usePrefsStore.getState().updateLayout({ panelOpen: true });
    expect(usePrefsStore.getState().layout).toEqual({
      sidebarOpen: true,
      panelOpen: true,
    });
    expect(persistPreference).toHaveBeenCalledWith({
      key: "readerLayout",
      value: { sidebarOpen: true, panelOpen: true },
    });
  });
  it("layout defaults to sidebar open and panel closed", () => {
    expect(PREFS_INITIAL.layout).toEqual({
      sidebarOpen: true,
      panelOpen: false,
    });
  });
  it("setStepLimit updates value and persists", () => {
    usePrefsStore.getState().setStepLimit(0);
    expect(usePrefsStore.getState().stepLimit).toBe(0);
    expect(persistPreference).toHaveBeenCalledWith({ key: "stepLimit", value: 0 });
  });
  it("stepLimit defaults to DEFAULT_STEP_LIMIT", () => {
    expect(PREFS_INITIAL.stepLimit).toBe(DEFAULT_STEP_LIMIT);
  });
  it("setBackgroundConcurrency updates value and persists", () => {
    usePrefsStore.getState().setBackgroundConcurrency(5);
    expect(usePrefsStore.getState().backgroundConcurrency).toBe(5);
    expect(persistPreference).toHaveBeenCalledWith({ key: "backgroundConcurrency", value: 5 });
  });
  it("backgroundConcurrency defaults to DEFAULT_BACKGROUND_CONCURRENCY", () => {
    expect(PREFS_INITIAL.backgroundConcurrency).toBe(DEFAULT_BACKGROUND_CONCURRENCY);
  });
});
