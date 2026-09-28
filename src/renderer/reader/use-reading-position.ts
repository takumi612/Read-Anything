import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMachine, type VirtualDocsHandle } from "@marginalia/virtual-docs";
import { createLogger } from "@renderer/logger";
import { qk } from "../query/keys";
import type { ProgressDto, SaveProgressInput } from "@shared/library";
import type { EpubBook } from "./epub-book";
import {
  initialReadingPositionState,
  reduceReadingPosition,
  type ReadingPosition,
  type ReadingPositionEffect,
  type ReadingPositionEvent,
  type ReadingPositionState,
} from "./reading-position-machine";
import { ttsController } from "./tts/tts-controller";

const log = createLogger("epub");

const SAVE_DEBOUNCE_MS = 1000;

interface Args {
  bookId: string;
  book: EpubBook | null;
  persistProgress: boolean;
  vRef: React.RefObject<VirtualDocsHandle | null>;
  /** Đổi CFI thành phần tử neo trong section; trả null nếu thất bại để về đầu section. */
  resolveCfiElement: (cfi: string) => (doc: Document) => Element | null;
  /** Đổi id chương thành { index, anchor }; trả null nếu thiếu chương hoặc không định vị được href. */
  resolveChapterTarget: (chapterId: string) => { index: number; anchor: string | null } | null;
  /** Ghi ảnh chụp vị trí vào navigation store: chương, ngữ cảnh đọc và phần trăm tiến độ. */
  reportPosition: (position: ReadingPosition) => void;
}

export function useReadingPosition({
  bookId,
  book,
  persistProgress,
  vRef,
  resolveCfiElement,
  resolveChapterTarget,
  reportPosition,
}: Args): {
  state: ReadingPositionState;
  raise: (event: ReadingPositionEvent) => void;
} {
  const qc = useQueryClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgress = useRef<SaveProgressInput | null>(null);
  const stateRef = useRef<ReadingPositionState>(initialReadingPositionState());
  const raiseRef = useRef<((event: ReadingPositionEvent) => void) | null>(null);

  const flushProgress = useCallback(
    (sync: boolean) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const input = pendingProgress.current;
      pendingProgress.current = null;
      if (!input || stateRef.current.kind !== "following") return;
      if (sync) {
        if (!window.api.progress.saveSync(input)) log.warn("synchronous progress save failed");
      } else {
        void window.api.progress
          .save(input)
          .catch((err: unknown) => log.warn("save progress failed", err));
      }
      qc.setQueryData<ProgressDto | null>(qk.progress(input.bookId), (previous) => ({
        locator: input.locator,
        percent: previous?.percent ?? null,
      }));
    },
    [qc],
  );

  const runEffect = (effect: ReadingPositionEffect) => {
    switch (effect.kind) {
      case "restoreToCfi": {
        const handle = vRef.current;
        // Nếu thiếu handle, tự phát sự kiện kết thúc. Optional chaining bỏ qua lời gọi sẽ khiến
        // RESTORE_FINISHED không tới, state kẹt ở restoring và tiến độ không được lưu nữa.
        if (!handle) {
          raiseRef.current?.({ type: "RESTORE_FINISHED", result: "cancelled" });
          return;
        }
        // owner="restore" là định vị do hệ thống, không tính là người dùng điều hướng;
        // giữ overscan phía trên bằng 0 để đo chiều cao section tới muộn không đẩy lệch vị trí.
        // Khi người dùng chủ động chuyển, truyền "user".
        void handle
          .scrollToSectionElement(effect.targetIndex, resolveCfiElement(effect.locator), {
            owner: "restore",
          })
          .then((result) => raiseRef.current?.({ type: "RESTORE_FINISHED", result }));
        return;
      }
      case "scrollToAnnotation": {
        const index = book?.indexOfCfi(effect.locator) ?? -1;
        if (index < 0) return;
        void vRef.current?.scrollToSectionElement(index, resolveCfiElement(effect.locator), {
          owner: "user",
        });
        return;
      }
      case "scrollToChapter": {
        const target = resolveChapterTarget(effect.chapterId);
        if (!target) return;
        if (target.anchor) void vRef.current?.scrollToAnchor(target.index, target.anchor);
        else vRef.current?.scrollToIndex(target.index);
        return;
      }
      case "notifyTtsUserNavigation":
        ttsController.notifyUserNavigation();
        return;
      case "reportPosition":
        reportPosition(effect.position);
        return;
      case "persistProgress": {
        if (!persistProgress || !effect.position.cfi) return;
        const { cfi } = effect.position;
        pendingProgress.current = { bookId, locator: cfi };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => flushProgress(false), SAVE_DEBOUNCE_MS);
        return;
      }
    }
  };

  const [state, raise] = useMachine(
    reduceReadingPosition,
    initialReadingPositionState(),
    runEffect,
    {
      describeState: (s) => s.kind,
      onTransition: (r) => log.debug("reading position transition", r),
    },
  );
  stateRef.current = state;
  raiseRef.current = raise;

  // Switch to the next book after the previous book's effect cleanup has flushed its position.
  useEffect(() => {
    raise({ type: "BOOK_CHANGED" });
  }, [bookId, raise]);

  useEffect(() => {
    const onBeforeUnload = () => flushProgress(true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushProgress(false);
    };
  }, [bookId, flushProgress]);

  return { state, raise };
}
