export type ReaderPanelAccessibilityView =
  | "assistant"
  | "annotations"
  | "vocabulary"
  | "bookmarks"
  | "notes";

export function getReaderPanelOverlayCloseLabel(view: ReaderPanelAccessibilityView) {
  return view === "assistant"
    ? { key: "reader.collapseAiPanel", fallback: "Close AI assistant" }
    : { key: "ai.closePanel", fallback: "Close panel" };
}

export function getReaderPanelRegionLabel(view: ReaderPanelAccessibilityView) {
  switch (view) {
    case "assistant":
      return { key: "reader.aiAssistantPanel", fallback: "AI assistant panel" };
    case "annotations":
      return { key: "reader.annotations", fallback: "Annotations" };
    case "vocabulary":
      return { key: "reader.vocabulary", fallback: "Vocabulary" };
    case "bookmarks":
      return { key: "reader.pdf.bookmarks.title", fallback: "Bookmarks" };
    case "notes":
      return { key: "reader.bookNotes", fallback: "Notes" };
  }
}
