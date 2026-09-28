import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@renderer/store/lazy-storage";

export interface PdfTab {
  bookId: string;
  mode: "active" | "reference";
}

interface PdfTabsState {
  tabs: PdfTab[];
  activeBookId: string | null;
  register: (tab: PdfTab) => void;
  activate: (bookId: string) => void;
  close: (bookId: string) => void;
  retain: (validBookIds: string[]) => void;
  clear: () => void;
}

function validTab(value: unknown): value is PdfTab {
  if (!value || typeof value !== "object") return false;
  const tab = value as Partial<PdfTab>;
  return (
    typeof tab.bookId === "string" &&
    tab.bookId.length > 0 &&
    (tab.mode === "active" || tab.mode === "reference")
  );
}

export const usePdfTabsStore = create<PdfTabsState>()(
  persist(
    (set) => ({
      tabs: [],
      activeBookId: null,
      register: (tab) =>
        set((state) => ({
          tabs: state.tabs.some((entry) => entry.bookId === tab.bookId)
            ? state.tabs.map((entry) => (entry.bookId === tab.bookId ? tab : entry))
            : [...state.tabs, tab],
          activeBookId: tab.bookId,
        })),
      activate: (activeBookId) => set({ activeBookId }),
      close: (bookId) =>
        set((state) => {
          const tabs = state.tabs.filter((tab) => tab.bookId !== bookId);
          return {
            tabs,
            activeBookId:
              state.activeBookId === bookId ? (tabs.at(-1)?.bookId ?? null) : state.activeBookId,
          };
        }),
      retain: (validBookIds) =>
        set((state) => {
          const valid = new Set(validBookIds);
          const tabs = state.tabs.filter((tab) => valid.has(tab.bookId));
          return {
            tabs,
            activeBookId: tabs.some((tab) => tab.bookId === state.activeBookId)
              ? state.activeBookId
              : (tabs.at(-1)?.bookId ?? null),
          };
        }),
      clear: () => set({ tabs: [], activeBookId: null }),
    }),
    {
      name: "marginalia-pdf-tabs",
      storage: safeStorage,
      partialize: (state) => ({ tabs: state.tabs, activeBookId: state.activeBookId }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PdfTabsState> | null;
        const tabs = Array.isArray(saved?.tabs) ? saved.tabs.filter(validTab) : [];
        const activeBookId =
          typeof saved?.activeBookId === "string" &&
          tabs.some((tab) => tab.bookId === saved.activeBookId)
            ? saved.activeBookId
            : (tabs.at(-1)?.bookId ?? null);
        return { ...current, tabs, activeBookId };
      },
    },
  ),
);
