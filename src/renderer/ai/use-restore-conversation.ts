import { useEffect } from "react";
import { useChatStore } from "@renderer/store/chat-store";
import type { ChatContext } from "@renderer/ai/chat-context";
import { createLogger } from "@renderer/logger";

const log = createLogger("chat");

type RestoreTarget = { kind: "restore"; id: string } | { kind: "empty" };

/**
 * Chọn hội thoại cần khôi phục trong context từ danh sách mới nhất trước và giá trị đã nhớ.
 * Ưu tiên id còn tồn tại, sau đó trạng thái rỗng được nhớ, rồi hội thoại mới nhất.
 * remembered là id có trong danh sách thì mở lại đúng hội thoại đó.
 * remembered=null thì giữ trạng thái chuẩn bị tạo hội thoại mới.
 * Nếu id cũ không còn hoặc chưa có giá trị nhớ thì chọn list[0]; danh sách rỗng thì để trống.
 */
export function pickRestoreTarget(
  list: readonly { id: string }[],
  remembered: string | null | undefined,
): RestoreTarget {
  const has = (id: string) => list.some((c) => c.id === id);
  if (typeof remembered === "string" && has(remembered)) return { kind: "restore", id: remembered };
  if (remembered === null) return { kind: "empty" };
  const latest = list[0];
  return latest ? { kind: "restore", id: latest.id } : { kind: "empty" };
}

type RestoreSlots = {
  activeByBook: Record<string, string | null>;
  activeLibraryConversation: string | null;
};
type RestoreAction = RestoreTarget;

/**
 * Chọn ô nhớ theo context: sách dùng activeByBook[bookId], thư viện dùng activeLibraryConversation,
 * rồi quyết định qua pickRestoreTarget. Giá trị ban đầu của thư viện là null nên lần đầu mở ở trạng thái rỗng.
 */
export function resolveRestore(
  ctx: ChatContext,
  slots: RestoreSlots,
  list: readonly { id: string }[],
): RestoreAction {
  const remembered =
    ctx.kind === "book" ? slots.activeByBook[ctx.bookId] : slots.activeLibraryConversation;
  const target = pickRestoreTarget(list, remembered);
  return target;
}

/**
 * Khôi phục hội thoại gần nhất cho context sách hoặc thư viện từ danh sách tương ứng.
 * resolveRestore chọn hội thoại hay trạng thái rỗng. Nếu có hội thoại, restoreConversation
 * phát openCommand kèm context để tải lịch sử mà không ép mở bảng.
 * Nếu rỗng, đặt active=null và xóa openCommand.
 *
 * Bỏ qua ctx=null, chẳng hạn trình đọc chưa có sách. Effect chỉ phụ thuộc kind và bookId ổn định,
 * không phụ thuộc object ctx được tạo lại mỗi lần render.
 */
export function useRestoreConversation(ctx: ChatContext | null) {
  const kind = ctx?.kind ?? null;
  const bookId = ctx?.kind === "book" ? ctx.bookId : null;
  useEffect(() => {
    if (!kind) return;
    const restoreCtx: ChatContext =
      bookId !== null ? { kind: "book", bookId } : { kind: "library" };
    let cancelled = false;
    void window.api.chat.conversations
      .listByBook({ bookId })
      .then((list) => {
        if (cancelled) return;
        const s = useChatStore.getState();
        const action = resolveRestore(restoreCtx, s, list);
        if (action.kind === "restore") {
          s.restoreConversation(restoreCtx, action.id);
        } else {
          s.setActiveConversation(restoreCtx, null);
        }
      })
      .catch((err: unknown) => log.warn("restore conversation failed", err));
    return () => {
      cancelled = true;
    };
  }, [kind, bookId]);
}
