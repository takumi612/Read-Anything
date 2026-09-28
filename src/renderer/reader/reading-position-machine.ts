import type { AlignResult } from "@marginalia/virtual-docs";

/**
 * State machine vị trí đọc, chỉ gồm logic và không phụ thuộc DOM, React hay store.
 *
 * Chỉ lưu tiến độ ở trạng thái following. Trong lúc khôi phục, danh sách ảo có thể đi qua
 * section trung gian; lưu lúc đó sẽ ghi nhầm vị trí. Chỉ mở khóa sau khi hoàn tất,
 * hết giờ hoặc người dùng chủ động thay vị trí.
 */

/** Ảnh chụp vị trí do executor tính trước TOP_SECTION_CHANGED; CFI, tỉ lệ và chương đều cần hình học DOM. */
export interface ReadingPosition {
  /** Chỉ số spine của section ở đầu khung nhìn. */
  index: number;
  /** Vị trí tương đối của đầu khung nhìn trong section, từ 0 đến 1. */
  scrollRatio: number;
  /** Range CFI của ký tự đầu trong phần tử khối tại đầu khung nhìn. */
  cfi: string;
  /** Tiến độ đọc cả sách, từ 0 đến 1. */
  percent: number;
  chapterId: string | null;
  chapterTitle: string | null;
  /** Vị trí ký tự trong chương cho công cụ đọc vị trí hiện tại. */
  offset: number;
}

export type ReadingPositionState =
  | { kind: "loading" }
  | { kind: "restoring"; targetIndex: number; locator: string }
  | { kind: "following" };

export type ReadingPositionEvent =
  /** Sách và tiến độ đã tải; targetIndex là chỉ số spine từ locator, null nếu phân tích thất bại. */
  | { type: "SESSION_READY"; locator: string | null; targetIndex: number | null }
  | { type: "RESTORE_FINISHED"; result: AlignResult }
  | { type: "USER_NAVIGATED" }
  | { type: "CHAPTER_REQUESTED"; chapterId: string }
  | { type: "ANNOTATION_SCROLL"; locator: string }
  | { type: "TOP_SECTION_CHANGED"; position: ReadingPosition }
  | { type: "BOOK_CHANGED" };

export type ReadingPositionEffect =
  | { kind: "restoreToCfi"; locator: string; targetIndex: number }
  | { kind: "scrollToChapter"; chapterId: string }
  | { kind: "scrollToAnnotation"; locator: string }
  | { kind: "notifyTtsUserNavigation" }
  | { kind: "reportPosition"; position: ReadingPosition }
  | { kind: "persistProgress"; position: ReadingPosition };

export interface ReadingPositionTransition {
  next: ReadingPositionState;
  effects: ReadingPositionEffect[];
}

export function initialReadingPositionState(): ReadingPositionState {
  return { kind: "loading" };
}

export function reduceReadingPosition(
  state: ReadingPositionState,
  event: ReadingPositionEvent,
): ReadingPositionTransition {
  switch (event.type) {
    case "BOOK_CHANGED":
      return { next: { kind: "loading" }, effects: [] };

    case "SESSION_READY": {
      // Bỏ qua ngoài trạng thái loading vì cập nhật cache tiến độ có thể phát lại sự kiện này.
      if (state.kind !== "loading") return { next: state, effects: [] };
      if (event.locator == null || event.targetIndex == null)
        return { next: { kind: "following" }, effects: [] };
      return {
        next: { kind: "restoring", targetIndex: event.targetIndex, locator: event.locator },
        effects: [{ kind: "restoreToCfi", locator: event.locator, targetIndex: event.targetIndex }],
      };
    }

    case "RESTORE_FINISHED":
      // Hoàn tất, hết giờ hoặc bị hủy đều phải rời restoring; không giữ state này vĩnh viễn.
      if (state.kind !== "restoring") return { next: state, effects: [] };
      return { next: { kind: "following" }, effects: [] };

    case "USER_NAVIGATED":
      if (state.kind === "loading") return { next: state, effects: [] };
      return { next: { kind: "following" }, effects: [] };

    case "CHAPTER_REQUESTED":
      // Bỏ qua khi loading vì currentChapterId ban đầu có thể là giá trị cũ trong store.
      // Chuyển theo nó quá sớm sẽ gắn nội dung dài trước khi initialIndex tới đúng vị trí.
      if (state.kind === "loading") return { next: state, effects: [] };
      return {
        next: { kind: "following" },
        effects: [
          { kind: "notifyTtsUserNavigation" },
          { kind: "scrollToChapter", chapterId: event.chapterId },
        ],
      };

    case "ANNOTATION_SCROLL":
      if (state.kind === "loading") return { next: state, effects: [] };
      return {
        next: { kind: "following" },
        effects: [
          { kind: "notifyTtsUserNavigation" },
          { kind: "scrollToAnnotation", locator: event.locator },
        ],
      };

    case "TOP_SECTION_CHANGED":
      return {
        next: state,
        effects:
          state.kind === "following"
            ? [
                { kind: "reportPosition", position: event.position },
                { kind: "persistProgress", position: event.position },
              ]
            : [{ kind: "reportPosition", position: event.position }],
      };
  }
}
