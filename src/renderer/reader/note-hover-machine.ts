/** Hình chữ nhật điểm neo theo tọa độ khung nhìn, cùng cấu trúc với ViewportRect và SelectionInfo.rect. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HoverState {
  /** Id chú thích đang được trỏ tới; null nếu không có. */
  annoId: string | null;
  /** Điểm neo đặt thẻ theo tọa độ khung nhìn. */
  anchorRect: AnchorRect | null;
  /** Thẻ có đang mở hay không. */
  open: boolean;
}

/** Lệnh timer cho store: start bắt đầu chờ đóng, cancel hủy chờ, none giữ nguyên. */
export type TimerCmd = "start" | "cancel" | "none";

export type HoverEvent =
  | { type: "enterHighlight"; annoId: string; rect: AnchorRect }
  | { type: "leaveHighlight" }
  | { type: "enterCard" }
  | { type: "leaveCard" }
  | { type: "closeNow" };

export const HOVER_INITIAL: HoverState = { annoId: null, anchorRect: null, open: false };

export interface HoverResult {
  next: HoverState;
  timer: TimerCmd;
}

/**
 * State machine hover dạng hàm thuần; store thực hiện setTimeout theo lệnh timer.
 * Khi rời vùng tô sáng, chờ 150 ms để con trỏ có thể đi vào thẻ; khi vào thẻ thì hủy timer.
 */
export function reduceHover(state: HoverState, event: HoverEvent): HoverResult {
  switch (event.type) {
    case "enterHighlight": {
      // Nếu cùng id đã mở, chỉ cập nhật điểm neo theo đoạn hiện tại để thẻ không nhấp nháy.
      if (state.open && state.annoId === event.annoId) {
        return { next: { ...state, anchorRect: event.rect }, timer: "cancel" };
      }
      return {
        next: { annoId: event.annoId, anchorRect: event.rect, open: true },
        timer: "cancel",
      };
    }
    case "leaveHighlight":
      // Rời vùng tô sáng thì bắt đầu chờ đóng, tạm giữ trạng thái để con trỏ vào thẻ.
      return { next: state, timer: "start" };
    case "enterCard":
      return { next: state, timer: "cancel" };
    case "leaveCard":
      return { next: state, timer: "start" };
    case "closeNow":
      return { next: HOVER_INITIAL, timer: "cancel" };
  }
}
