import { useCallback } from "react";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useChatStore } from "@renderer/store/chat-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { openPanelAndFocusComposer } from "@renderer/ai/composer-focus";
import { presetDraftText, type PresetId } from "@renderer/ai/ai-action-draft";
import i18n from "@renderer/i18n";

export type { PresetId };

/** Lấy prompt preset đã dịch tại thời điểm gọi để theo ngôn ngữ giao diện. */
function resolvePresetPrompt(preset: PresetId): string {
  switch (preset) {
    case "explain":
      return i18n.t("ai.action.explain", "Hãy giải thích nội dung đã chọn.");
    case "translate":
      return i18n.t("ai.action.translate", "Hãy dịch nội dung đã chọn sang tiếng Việt.");
    case "summarize":
      return i18n.t("ai.action.summarize", "Hãy tóm tắt nội dung đã chọn.");
  }
}

export function useAiActions() {
  const startAiAction = useCallback(async (preset: PresetId | null) => {
    const { selection, setSelection } = useAnnotationStore.getState();
    const { setDraftChips, setDraftText } = useChatStore.getState();
    const bookId = useNavigationStore.getState().currentBookId;
    if (!selection || !bookId) return;
    const chips = await window.api.ai.buildChips({
      selection: selection.selectionText,
      paragraphBefore: selection.paragraphBefore,
      paragraphCurrent: selection.paragraphCurrent,
      paragraphAfter: selection.paragraphAfter,
    });
    if (preset === null) {
      setDraftChips(chips);
      setDraftText(
        i18n.t(
          "ai.selection.explainInContext",
          "Explain the selected passage in the context of the book.",
        ),
      );
    } else {
      setDraftChips(chips);
      const next = presetDraftText(preset, resolvePresetPrompt);
      if (next !== null) setDraftText(next);
    }
    openPanelAndFocusComposer();
    setSelection(null); // Ẩn thanh công cụ.
  }, []);

  return { startAiAction };
}
