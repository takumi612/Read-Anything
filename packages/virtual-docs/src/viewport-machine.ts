/**
 * Máy trạng thái quyền điều khiển viewport; chỉ có logic, không phụ thuộc DOM/React.
 *
 * Xác định ai đang điều khiển vùng cuộn và thao tác định vị đã ổn định đến đâu.
 * Reducer trả về effect để VirtualDocs thực thi; bản thân reducer có thể kiểm thử độc lập.
 */

/** Ba trạng thái kết thúc đều hoàn tất Promise của scrollToSectionElement. */
export type AlignResult = "settled" | "timeout" | "cancelled";

/**
 * Ngưỡng xác nhận vị trí ổn định. Section dài có thể lệch lại khi iframe phía trước
 * đo chiều cao muộn, nên cần quan sát ít nhất 6 giây và 5 lần căn chỉnh liên tiếp.
 */
export const ALIGN_MINIMUM_ATTEMPTS = 60;
export const ALIGN_SUCCESSES_REQUIRED = 5;
/** Giới hạn 30 giây để chờ section dài đo xong; hết hạn báo timeout. */
export const ALIGN_MAX_ATTEMPTS = 300;

export type ViewportPhase =
  | { kind: "systemOwned" }
  | {
      kind: "aligning";
      runId: number;
      target: number;
      owner: "restore" | "user";
      attempts: number;
      streak: number;
    }
  | { kind: "userOwned" };

export interface ViewportState {
  phase: ViewportPhase;
  /** Chỉ số section thấp nhất được phép tải; section trước đó giữ placeholder nhẹ. */
  loadedFromIndex: number;
  /** Đã có điều hướng của người dùng, kể cả nhảy chương; khôi phục vị trí không tính. */
  everUserNavigated: boolean;
  nextRunId: number;
}

export type ViewportEvent =
  | { type: "ALIGN_REQUESTED"; index: number; owner: "restore" | "user" }
  | { type: "JUMP_REQUESTED"; index: number }
  /** Độ lệch của phần tử đích so với đầu section; null khi chưa tìm thấy. */
  | { type: "ALIGN_TICK"; runId: number; aligned: boolean; offset: number | null }
  /** Phân biệt thao tác cuộn thật (wheel/touch/key) với pointerdown đơn lẻ. */
  | { type: "USER_INPUT"; scrollIntent: boolean }
  | { type: "VISIBLE_TOP_CHANGED"; index: number };

export type ViewportEffect =
  | { kind: "scrollToIndex"; index: number; offset?: number }
  | { kind: "startTicker"; runId: number }
  | { kind: "stopTicker" }
  | { kind: "reportAlignResult"; result: AlignResult }
  | { kind: "recomputeTop" };

export interface ViewportTransition {
  next: ViewportState;
  effects: ViewportEffect[];
}

export function initialViewportState(initialIndex: number): ViewportState {
  return {
    phase: { kind: "systemOwned" },
    loadedFromIndex: initialIndex,
    everUserNavigated: false,
    nextRunId: 1,
  };
}

/** Effect khi thao tác định vị bị thay thế hoặc hủy: hoàn tất kết quả trước rồi dừng timer. */
function cancelEffects(state: ViewportState): ViewportEffect[] {
  return state.phase.kind === "aligning"
    ? [{ kind: "reportAlignResult", result: "cancelled" }, { kind: "stopTicker" }]
    : [];
}

export function reduceViewport(state: ViewportState, event: ViewportEvent): ViewportTransition {
  switch (event.type) {
    case "ALIGN_REQUESTED": {
      const runId = state.nextRunId;
      return {
        next: {
          phase: {
            kind: "aligning",
            runId,
            target: event.index,
            owner: event.owner,
            attempts: 0,
            streak: 0,
          },
          loadedFromIndex: Math.min(state.loadedFromIndex, event.index),
          everUserNavigated: state.everUserNavigated || event.owner === "user",
          nextRunId: runId + 1,
        },
        effects: [
          ...cancelEffects(state),
          { kind: "scrollToIndex", index: event.index },
          { kind: "startTicker", runId },
        ],
      };
    }

    case "JUMP_REQUESTED":
      return {
        next: {
          ...state,
          phase: { kind: "systemOwned" },
          loadedFromIndex: Math.min(state.loadedFromIndex, event.index),
          everUserNavigated: true,
        },
        effects: [...cancelEffects(state), { kind: "scrollToIndex", index: event.index }],
      };

    case "ALIGN_TICK": {
      // Tick của runId cũ không được ảnh hưởng đến lần định vị mới.
      if (state.phase.kind !== "aligning" || state.phase.runId !== event.runId)
        return { next: state, effects: [] };
      const attempts = state.phase.attempts + 1;
      const streak = event.aligned ? state.phase.streak + 1 : 0;
      if (attempts >= ALIGN_MINIMUM_ATTEMPTS && streak >= ALIGN_SUCCESSES_REQUIRED)
        return {
          next: { ...state, phase: { kind: "systemOwned" } },
          effects: [
            { kind: "stopTicker" },
            { kind: "reportAlignResult", result: "settled" },
            { kind: "recomputeTop" },
          ],
        };
      if (attempts >= ALIGN_MAX_ATTEMPTS)
        return {
          next: { ...state, phase: { kind: "systemOwned" } },
          effects: [{ kind: "stopTicker" }, { kind: "reportAlignResult", result: "timeout" }],
        };
      const target = state.phase.target;
      return {
        next: { ...state, phase: { ...state.phase, attempts, streak } },
        effects: event.aligned
          ? []
          : [
              // Chưa tìm thấy phần tử: định vị theo section trước để iframe được render;
              // tick kế tiếp sẽ thử tìm lại phần tử.
              event.offset == null
                ? { kind: "scrollToIndex", index: target }
                : { kind: "scrollToIndex", index: target, offset: event.offset },
            ],
      };
    }

    case "USER_INPUT": {
      const effects = cancelEffects(state);
      // pointerdown đơn lẻ chỉ hủy định vị đang chạy, không chuyển quyền điều khiển viewport.
      if (!event.scrollIntent)
        return {
          next:
            state.phase.kind === "aligning" ? { ...state, phase: { kind: "systemOwned" } } : state,
          effects,
        };
      return {
        next: { ...state, phase: { kind: "userOwned" }, everUserNavigated: true },
        effects,
      };
    }

    case "VISIBLE_TOP_CHANGED": {
      if (state.phase.kind !== "userOwned") return { next: state, effects: [] };
      const loadedFromIndex = Math.min(state.loadedFromIndex, event.index);
      if (loadedFromIndex === state.loadedFromIndex) return { next: state, effects: [] };
      return { next: { ...state, loadedFromIndex }, effects: [] };
    }
  }
}

/**
 * Khi mở lại ở vị trí sâu và người dùng chưa điều hướng, không render trước section phía trên:
 * đo chiều cao muộn ở phía trên có thể đẩy lệch vị trí cần khôi phục.
 * Sau điều hướng đầu tiên của người dùng, bật lại overscan hai chiều.
 */
export function overscanTop(state: ViewportState, initialIndex: number, fullTop: number): number {
  return initialIndex > 0 && !state.everUserNavigated ? 0 : fullTop;
}
