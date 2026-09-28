import { create } from "zustand";
import type { ReadingContext } from "@shared/chat";
import { useChatStore } from "@renderer/store/chat-store";
import type { PdfProgressLocator } from "@renderer/reader/pdf-locator";

interface PdfHistory {
  back: PdfProgressLocator[];
  forward: PdfProgressLocator[];
}

export type PdfFitMode = "custom" | "width" | "page";

function samePdfPosition(a: PdfProgressLocator, b: PdfProgressLocator): boolean {
  return a.page === b.page && Math.abs(a.scrollRatio - b.scrollRatio) < 0.04;
}

interface NavigationState {
  view: "library" | "stats" | "book";
  currentBookId: string | null;
  bookMode: "auto" | "reference";
  currentChapterId: string | null;
  readingContext: ReadingContext | null;
  /** Tiến độ đọc từ 0 đến 1 để hiện trên breadcrumb; readingContext riêng phục vụ hợp đồng chat AI. */
  readingPercent: number | null;
  pdfHistoryByBook: Record<string, PdfHistory>;
  pdfVocabularyVisibleByBook: Record<string, boolean>;
  pdfFitModeByBook: Record<string, PdfFitMode>;
  pdfEffectiveZoomByBook: Record<string, number>;
}
interface NavigationActions {
  openBook: (bookId: string, chapterId?: string | null) => void;
  openBookReference: (bookId: string) => void;
  backToLibrary: () => void;
  showLibrary: () => void;
  showStats: () => void;
  setCurrentChapter: (chapterId: string) => void;
  setReadingContext: (readingContext: ReadingContext | null) => void;
  setReadingPercent: (readingPercent: number | null) => void;
  recordPdfJump: (bookId: string, from: PdfProgressLocator, to: PdfProgressLocator) => void;
  goPdfBack: (bookId: string, current: PdfProgressLocator) => PdfProgressLocator | null;
  goPdfForward: (bookId: string, current: PdfProgressLocator) => PdfProgressLocator | null;
  setPdfVocabularyVisible: (bookId: string, visible: boolean) => void;
  setPdfFitMode: (bookId: string, mode: PdfFitMode) => void;
  setPdfEffectiveZoom: (bookId: string, zoom: number) => void;
  clearPdfBookState: (bookId: string) => void;
}

export const NAVIGATION_INITIAL: NavigationState = {
  view: "library",
  currentBookId: null,
  bookMode: "auto",
  currentChapterId: null,
  readingContext: null,
  readingPercent: null,
  pdfHistoryByBook: {},
  pdfVocabularyVisibleByBook: {},
  pdfFitModeByBook: {},
  pdfEffectiveZoomByBook: {},
};

export const useNavigationStore = create<NavigationState & NavigationActions>((set) => ({
  ...NAVIGATION_INITIAL,
  openBook: (bookId, chapterId = null) => {
    set({
      view: "book",
      currentBookId: bookId,
      bookMode: "auto",
      currentChapterId: chapterId,
      readingContext: null,
      readingPercent: null,
    });
    useChatStore.getState().resetForBookSwitch(); // Xóa openCommand cũ khi đổi sách; active được khôi phục từ activeByBook.
  },
  openBookReference: (bookId) => {
    set({
      view: "book",
      currentBookId: bookId,
      bookMode: "reference",
      readingContext: null,
      readingPercent: null,
    });
    useChatStore.getState().resetForBookSwitch();
  },
  // Chỉ chuyển view về library; giữ id sách/chương vì App không đọc chúng trong view library.
  backToLibrary: () => set({ view: "library" }),
  showLibrary: () => set({ view: "library" }),
  showStats: () => set({ view: "stats" }),
  setCurrentChapter: (currentChapterId) => set({ currentChapterId }),
  setReadingContext: (readingContext) => set({ readingContext }),
  setReadingPercent: (readingPercent) => set({ readingPercent }),
  recordPdfJump: (bookId, from, to) =>
    set((s) => {
      if (samePdfPosition(from, to)) return s;
      const previous = s.pdfHistoryByBook[bookId] ?? { back: [], forward: [] };
      return {
        pdfHistoryByBook: {
          ...s.pdfHistoryByBook,
          [bookId]: { back: [...previous.back, from].slice(-60), forward: [] },
        },
      };
    }),
  goPdfBack: (bookId, current) => {
    let target: PdfProgressLocator | null = null;
    set((s) => {
      const previous = s.pdfHistoryByBook[bookId];
      if (!previous?.back.length) return s;
      target = previous.back.at(-1)!;
      return {
        pdfHistoryByBook: {
          ...s.pdfHistoryByBook,
          [bookId]: {
            back: previous.back.slice(0, -1),
            forward: [...previous.forward, current].slice(-60),
          },
        },
      };
    });
    return target;
  },
  goPdfForward: (bookId, current) => {
    let target: PdfProgressLocator | null = null;
    set((s) => {
      const previous = s.pdfHistoryByBook[bookId];
      if (!previous?.forward.length) return s;
      target = previous.forward.at(-1)!;
      return {
        pdfHistoryByBook: {
          ...s.pdfHistoryByBook,
          [bookId]: {
            back: [...previous.back, current].slice(-60),
            forward: previous.forward.slice(0, -1),
          },
        },
      };
    });
    return target;
  },
  setPdfVocabularyVisible: (bookId, visible) =>
    set((s) => ({
      pdfVocabularyVisibleByBook: { ...s.pdfVocabularyVisibleByBook, [bookId]: visible },
    })),
  setPdfFitMode: (bookId, mode) =>
    set((s) => ({ pdfFitModeByBook: { ...s.pdfFitModeByBook, [bookId]: mode } })),
  setPdfEffectiveZoom: (bookId, zoom) =>
    set((s) =>
      s.pdfEffectiveZoomByBook[bookId] === zoom
        ? s
        : { pdfEffectiveZoomByBook: { ...s.pdfEffectiveZoomByBook, [bookId]: zoom } },
    ),
  clearPdfBookState: (bookId) =>
    set((s) => {
      const pdfHistoryByBook = { ...s.pdfHistoryByBook };
      const pdfVocabularyVisibleByBook = { ...s.pdfVocabularyVisibleByBook };
      const pdfFitModeByBook = { ...s.pdfFitModeByBook };
      const pdfEffectiveZoomByBook = { ...s.pdfEffectiveZoomByBook };
      delete pdfHistoryByBook[bookId];
      delete pdfVocabularyVisibleByBook[bookId];
      delete pdfFitModeByBook[bookId];
      delete pdfEffectiveZoomByBook[bookId];
      return {
        pdfHistoryByBook,
        pdfVocabularyVisibleByBook,
        pdfFitModeByBook,
        pdfEffectiveZoomByBook,
      };
    }),
}));
