import { describe, expect, it } from "vitest";
import {
  getReaderPanelOverlayCloseLabel,
  getReaderPanelRegionLabel,
} from "./reader-panel-accessibility";

describe("reader panel overlay close labels", () => {
  it("uses the AI assistant label when the assistant is open", () => {
    expect(getReaderPanelOverlayCloseLabel("assistant")).toEqual({
      key: "reader.collapseAiPanel",
      fallback: "Close AI assistant",
    });
  });

  it.each(["annotations", "vocabulary", "bookmarks", "notes"] as const)(
    "uses the generic panel label when %s is open",
    (view) => {
      expect(getReaderPanelOverlayCloseLabel(view)).toEqual({
        key: "ai.closePanel",
        fallback: "Close panel",
      });
    },
  );

  it.each([
    ["assistant", "reader.aiAssistantPanel", "AI assistant panel"],
    ["annotations", "reader.annotations", "Annotations"],
    ["vocabulary", "reader.vocabulary", "Vocabulary"],
    ["bookmarks", "reader.pdf.bookmarks.title", "Bookmarks"],
    ["notes", "reader.bookNotes", "Notes"],
  ] as const)("names the %s panel for its resize separator", (view, key, fallback) => {
    expect(getReaderPanelRegionLabel(view)).toEqual({ key, fallback });
  });
});
