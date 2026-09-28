import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chip } from "@shared/chat";
import { openPanelAndFocusComposer } from "@renderer/ai/composer-focus";
import { safeStorage } from "@renderer/store/lazy-storage";
import type { ChatContext, OpenCommand } from "@renderer/ai/chat-context";

interface ChatState {
  draftText: string;
  draftChips: Chip[];
  /**
   * Lệnh dùng một lần, không phải state: nonce tăng để AIPanel tải lịch sử hội thoại.
   * Tách khỏi hội thoại active; khi gửi tin chỉ ghi ô nhớ, không phát lệnh này,
   * tránh tải lại lịch sử và ghi đè nội dung vừa stream. Tương tự annotation-store.scrollCommand.
   * Lệnh mang nhãn context để resolveOpenCommandTarget loại lệnh thuộc context khác.
   */
  openCommand: OpenCommand | null;
  /**
   * Hội thoại active cuối của từng sách, là nguồn dữ liệu duy nhất và được lưu bền.
   * Giá trị là id; null nghĩa là đang chuẩn bị hội thoại mới; thiếu khóa nghĩa là chưa từng nhớ,
   * khi đó chọn hội thoại mới nhất. Hội thoại active được suy ra từ đây, không lưu riêng.
   */
  activeByBook: Record<string, string | null>;
  /**
   * Hội thoại active của trợ lý trong context thư viện, được lưu bền.
   */
  activeLibraryConversation: string | null;
}

interface ChatActions {
  /** Đặt hội thoại active cho context; id=null cũng xóa openCommand không còn hợp lệ. */
  setActiveConversation: (ctx: ChatContext, id: string | null) => void;
  setDraftText: (text: string) => void;
  setDraftChips: (chips: Chip[]) => void;
  /** Mở lại hội thoại: phát lệnh tải lịch sử, lưu ô nhớ và mở bảng qua bố cục prefs-store. */
  openConversation: (ctx: ChatContext, id: string) => void;
  /** Khôi phục hội thoại khi mở sách như openConversation nhưng không ép mở bảng. */
  restoreConversation: (ctx: ChatContext, id: string) => void;
  /** Khi đổi sách, xóa lệnh để không phát lại sang sách khác; giữ activeByBook và bản nháp. */
  resetForBookSwitch: () => void;
  clearBookConversation: (bookId: string) => void;
}

export const CHAT_INITIAL: ChatState = {
  draftText: "",
  draftChips: [],
  openCommand: null,
  activeByBook: {},
  activeLibraryConversation: null,
};

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    (set) => ({
      ...CHAT_INITIAL,
      setActiveConversation: (ctx, id) =>
        set((s) =>
          ctx.kind === "book"
            ? {
                activeByBook: { ...s.activeByBook, [ctx.bookId]: id },
                ...(id === null ? { openCommand: null } : {}),
              }
            : {
                activeLibraryConversation: id,
                ...(id === null ? { openCommand: null } : {}),
              },
        ),
      setDraftText: (draftText) => set({ draftText }),
      setDraftChips: (draftChips) => set({ draftChips }),
      openConversation: (ctx, id) => {
        openPanelAndFocusComposer();
        return set((s) => ({
          openCommand: { conversationId: id, context: ctx, nonce: (s.openCommand?.nonce ?? 0) + 1 },
          ...(ctx.kind === "book"
            ? { activeByBook: { ...s.activeByBook, [ctx.bookId]: id } }
            : { activeLibraryConversation: id }),
        }));
      },
      restoreConversation: (ctx, id) =>
        set((s) => ({
          openCommand: { conversationId: id, context: ctx, nonce: (s.openCommand?.nonce ?? 0) + 1 },
          ...(ctx.kind === "book"
            ? { activeByBook: { ...s.activeByBook, [ctx.bookId]: id } }
            : { activeLibraryConversation: id }),
        })),
      resetForBookSwitch: () => set({ openCommand: null }),
      clearBookConversation: (bookId) =>
        set((s) => {
          const activeByBook = { ...s.activeByBook };
          delete activeByBook[bookId];
          return {
            activeByBook,
            openCommand: null,
          };
        }),
    }),
    {
      name: "marginalia-chat",
      storage: safeStorage,
      partialize: (s) => ({
        activeByBook: s.activeByBook,
        activeLibraryConversation: s.activeLibraryConversation,
      }),
    },
  ),
);

/** Hội thoại active suy ra cho context hiện tại, dùng trong component. */
export function useActiveConversationId(ctx: ChatContext): string | null {
  return useChatStore((s) =>
    ctx.kind === "book"
      ? (s.activeByBook[ctx.bookId] ?? null)
      : (s.activeLibraryConversation ?? null),
  );
}

/** Dùng trong action, transport và những nơi không theo cơ chế phản ứng. */
export function getActiveConversationId(ctx: ChatContext): string | null {
  const s = useChatStore.getState();
  return ctx.kind === "book"
    ? (s.activeByBook[ctx.bookId] ?? null)
    : (s.activeLibraryConversation ?? null);
}
