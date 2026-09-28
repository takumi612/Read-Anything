import { create } from "zustand";
import {
  reduceHover,
  HOVER_INITIAL,
  type HoverState,
  type HoverEvent,
  type AnchorRect,
} from "@renderer/reader/note-hover-machine";

/** Thời gian chờ trước khi đóng sau khi rời vùng tô sáng hoặc thẻ, tính bằng ms. */
const CLOSE_DELAY_MS = 150;

interface NoteHoverActions {
  /** Báo con trỏ đi vào vùng tô sáng có ghi chú. */
  hoverHighlight: (annoId: string, rect: AnchorRect) => void;
  /** Báo con trỏ rời vùng tô sáng. */
  leaveHighlight: () => void;
  /** Con trỏ vào thẻ, hủy timer đóng. */
  enterCard: () => void;
  /** Con trỏ rời thẻ, bắt đầu chờ đóng. */
  leaveCard: () => void;
  /** Đóng ngay khi cuộn, chọn sửa, nhấn Esc hoặc nhấn bên ngoài. */
  closeNow: () => void;
}

// Store là singleton nên chỉ cần một timer đóng ở cấp module.
let closeTimer: ReturnType<typeof setTimeout> | null = null;
function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

export const useNoteHoverStore = create<HoverState & NoteHoverActions>((set, get) => {
  const dispatch = (event: HoverEvent) => {
    const { next, timer } = reduceHover(
      { annoId: get().annoId, anchorRect: get().anchorRect, open: get().open },
      event,
    );
    set(next);
    if (timer === "cancel") {
      clearCloseTimer();
    } else if (timer === "start") {
      clearCloseTimer();
      closeTimer = setTimeout(() => {
        closeTimer = null;
        set(HOVER_INITIAL);
      }, CLOSE_DELAY_MS);
    }
  };
  return {
    ...HOVER_INITIAL,
    hoverHighlight: (annoId, rect) => dispatch({ type: "enterHighlight", annoId, rect }),
    leaveHighlight: () => dispatch({ type: "leaveHighlight" }),
    enterCard: () => dispatch({ type: "enterCard" }),
    leaveCard: () => dispatch({ type: "leaveCard" }),
    closeNow: () => {
      clearCloseTimer();
      set(HOVER_INITIAL);
    },
  };
});
