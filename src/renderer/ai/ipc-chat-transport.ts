import type { ChatTransport, UIMessageChunk } from "ai";
import { v7 as uuidv7 } from "uuid";
import type { AiStreamEvent } from "@shared/chat";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useChatStore, getActiveConversationId } from "@renderer/store/chat-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import type { ChatUIMessage } from "@renderer/ai/types";
import { type ChatContext } from "@renderer/ai/chat-context";

/** Chữ ký của hàm đăng ký onChunk, khớp window.api.ai.onChunk và có thể thay bằng bản giả trong kiểm thử. */
type OnChunk = (streamId: string, cb: (ev: AiStreamEvent) => void) => () => void;

/**
 * Hàm thuần chuyển luồng sự kiện ai:chunk thành ReadableStream<UIMessageChunk>.
 * chunk được enqueue, finish đóng luồng, error báo lỗi; mọi trường hợp kết thúc đều hủy đăng ký.
 * Tách riêng để kiểm thử không cần window.api hoặc DOM.
 */
export function createEventStream(
  streamId: string,
  onChunk: OnChunk,
): ReadableStream<UIMessageChunk> {
  let unsub: (() => void) | undefined;
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      unsub = onChunk(streamId, (ev) => {
        if (ev.type === "chunk") controller.enqueue(ev.chunk);
        else if (ev.type === "finish") {
          controller.close();
          unsub?.();
        } else {
          controller.error(new Error(ev.message));
          unsub?.();
        }
      });
    },
    cancel() {
      unsub?.();
    },
  });
}

/** Văn bản thuần của tin người dùng cuối, ghép mọi text part. */
function lastUserText(messages: ChatUIMessage[]): string {
  const last = messages.at(-1);
  if (!last) return "";
  return last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/**
 * ChatTransport riêng kết nối runSend của main process qua ai:send, ai:abort và ai:chunk.
 * - Không gửi lịch sử; main process đọc nguồn lịch sử duy nhất từ DB để tạo prompt.
 * - Lấy userText và chips từ tin người dùng vừa gửi, với chips trong metadata.contextChips.
 *   Không đọc store.draftChips vì Composer xóa nó ngay sau khi gửi.
 * - bookId lấy từ context; tạo conversationId khi cần trước lúc gửi.
 * - Đăng ký ai:chunk trước khi gọi ai:send để không bỏ lỡ sự kiện.
 */
export function createIpcChatTransport(context: ChatContext): ChatTransport<ChatUIMessage> {
  const bookId = context.kind === "book" ? context.bookId : null;
  return {
    async sendMessages({ messages, abortSignal, trigger }) {
      const readingContext =
        context.kind === "book" ? useNavigationStore.getState().readingContext : null;
      const last = messages.at(-1);
      const userText = lastUserText(messages);
      const streamId = uuidv7();
      const stream = createEventStream(streamId, window.api.ai.onChunk);
      abortSignal?.addEventListener("abort", () => void window.api.ai.abort({ streamId }));

      if (trigger === "regenerate-message") {
        // Khi gửi lại, sửa hoặc tạo lại, lượt người dùng đích là messages.at(-1); regenerate đã bỏ câu trả lời sau đó.
        const conversationId = getActiveConversationId(context);
        if (!conversationId || !last) {
          void stream.cancel();
          const { default: i18n } = await import("@renderer/i18n");
          throw new Error(i18n.t("ai.cannotResend", "Không thể gửi lại: không tìm thấy cuộc trò chuyện hoặc tin nhắn"));
        }
        const webSearch = usePrefsStore.getState().webSearchEnabled;
        const ack = await window.api.ai.resend({
          streamId,
          conversationId,
          userMessageId: last.id,
          userText,
          webSearch,
        });
        if (!ack.ok) {
          void stream.cancel();
          throw new Error(ack.reason);
        }
        return stream;
      }

      // Khi gửi mới, tạo hội thoại nếu chưa có active.
      let conversationId = getActiveConversationId(context);
      if (!conversationId) {
        const convo = await window.api.chat.conversations.create({ bookId });
        useChatStore.getState().setActiveConversation(context, convo.id);
        conversationId = convo.id;
      }
      const chips = (last?.metadata?.contextChips ?? []).filter((c) => c.state !== "off");
      const webSearch = usePrefsStore.getState().webSearchEnabled;
      const ack = await window.api.ai.send({
        streamId,
        bookId,
        conversationId,
        chips,
        userText,
        readingContext,
        webSearch,
      });
      if (!ack.ok) {
        void stream.cancel(); // Hủy đăng ký để không rò rỉ listener.
        throw new Error(ack.reason); // Đưa useChat vào trạng thái lỗi.
      }
      return stream;
    },
    // Chuyển ngữ cảnh trong một cửa sổ không cần kết nối lại.
    reconnectToStream: async () => null,
  };
}
