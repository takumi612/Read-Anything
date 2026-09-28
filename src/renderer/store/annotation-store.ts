import { create } from "zustand";
import type { SelectionInfo } from "@renderer/types";

export type AnnoTarget = { type: "create" } | { type: "edit"; annotationId: string };
export interface StyleBarState {
  rect: { x: number; y: number; width: number; height: number };
  target: AnnoTarget;
}
export interface NoteModalState {
  target: AnnoTarget;
  /**
   * Ảnh chụp vùng chọn khi tạo gồm locatorRange và selectedText; khi sửa thì đọc từ chú thích.
   * Không dựa vào selection lúc lưu vì cuộn trong textarea ghi chú dài có thể khiến
   * listener scroll của EpubReader xóa vùng chọn và làm mất ghi chú.
   */
  anchor?: { locatorRange: string; selectedText: string };
}

interface AnnotationState {
  selection: SelectionInfo | null;
  styleBar: StyleBarState | null;
  noteModal: NoteModalState | null;
  /** Lệnh dùng một lần: nonce tăng để trình đọc cuộn tới locator, dạng CFI với ePub. */
  scrollCommand: {
    locator: string;
    nonce: number;
    citation?: boolean;
    citationQuote?: string;
    bookId?: string;
  } | null;
}
interface AnnotationActions {
  setSelection: (selection: SelectionInfo | null) => void;
  openStyleBar: (s: StyleBarState) => void;
  closeStyleBar: () => void;
  openNoteModal: (s: NoteModalState) => void;
  closeNoteModal: () => void;
  requestScroll: (
    locator: string,
    citation?: boolean,
    bookId?: string,
    citationQuote?: string,
  ) => void;
}

export const ANNOTATION_INITIAL: AnnotationState = {
  selection: null,
  styleBar: null,
  noteModal: null,
  scrollCommand: null,
};

export const useAnnotationStore = create<AnnotationState & AnnotationActions>((set) => ({
  ...ANNOTATION_INITIAL,
  setSelection: (selection) => set({ selection }),
  openStyleBar: (styleBar) => set({ styleBar }),
  closeStyleBar: () => set({ styleBar: null }),
  openNoteModal: (noteModal) => set({ noteModal }),
  closeNoteModal: () => set({ noteModal: null }),
  requestScroll: (locator, citation = false, bookId, citationQuote) =>
    set((s) => ({
      scrollCommand: {
        locator,
        citation,
        citationQuote,
        bookId,
        nonce: (s.scrollCommand?.nonce ?? 0) + 1,
      },
    })),
}));
