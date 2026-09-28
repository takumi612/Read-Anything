import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { MessagesSquare, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useChatStore, useActiveConversationId } from "@renderer/store/chat-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { createIpcChatTransport } from "@renderer/ai/ipc-chat-transport";
import { ensureAiDataConsent } from "@renderer/ai/ai-consent";
import type { ChatUIMessage } from "@renderer/ai/types";
import { MessageList } from "@renderer/ai/MessageList";
import { Composer } from "@renderer/ai/Composer";
import { ConversationsTab } from "@renderer/ai/ConversationsTab";
import { messagesToUI } from "@renderer/ai/message-history";
import {
  conversationOpenScrollBehavior,
  isScrollAtBottom,
  messageScrollBehavior,
} from "@renderer/ai/scroll-follow";
import { conversationsQuery } from "@renderer/query/conversation-queries";
import type { Chip, MessageDto } from "@shared/chat";
import { openPanelAndFocusComposer } from "@renderer/ai/composer-focus";
import { ChatActionsContext, nextAssistantId, type ChatActions } from "@renderer/ai/chat-actions";
import { ChatPerfMonitor } from "@renderer/ai/ChatPerfMonitor";
import { createLogger } from "@renderer/logger";
import { contextKey, resolveOpenCommandTarget, type ChatContext } from "@renderer/ai/chat-context";

const log = createLogger("ai");

const PAGE_SIZE = 80;
const SCROLL_TOP_THRESHOLD = 100;

interface PaginationState {
  hasMore: boolean;
  loadingMore: boolean;
  oldestSeq: number | null;
}

export function AIPanel({ context, onClose }: { context: ChatContext; onClose: () => void }) {
  const { t } = useTranslation();
  const { messages, sendMessage, status, stop, setMessages, regenerate, error } =
    useChat<ChatUIMessage>({
      transport: createIpcChatTransport(context),
      // Gom các thông báo messages: nếu mỗi chunk đều render đồng bộ thì mất khoảng 9 ms/chunk.
      // Với mô hình nhanh khoảng 200 chunk/giây, sự kiện IPC có thể dồn trên renderer gần 10 giây.
      // Các lần render ưu tiên cao còn ngắt cập nhật nội dung Streamdown trong startTransition.
      throttle: 50,
      // Ghi warn cho lỗi stream để có dấu vết trong log; banner lỗi vẫn hiển thị như trước.
      onError: (err) => log.warn("chat stream error", err),
    });
  const agentName = usePrefsStore((s) => s.soul.name);
  const openCommand = useChatStore((s) => s.openCommand);
  const activeConversationId = useActiveConversationId(context);
  const bookId = context.kind === "book" ? context.bookId : null;
  // Trong thư viện, danh sách hội thoại nằm trong bảng và header chuyển giữa chat với danh sách.
  // Ở trình đọc, danh sách nằm trong Sidebar.
  const [showList, setShowList] = useState(false);
  const convosQuery = useQuery(conversationsQuery(context));
  const activeTitle = activeConversationId
    ? convosQuery.data?.find((c) => c.id === activeConversationId)?.title?.trim() ||
      t("reader.conversation.untitled", "Cuộc trò chuyện chưa đặt tên")
    : null;
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followBottomRef = useRef(true);
  const prevStatus = useRef(status);
  const [pagination, setPagination] = useState<PaginationState>({
    hasMore: false,
    loadingMore: false,
    oldestSeq: null,
  });
  const seqMapRef = useRef<Map<string, number>>(new Map());
  const isOpeningRef = useRef(false);

  const resetPagination = () => {
    setPagination({ hasMore: false, loadingMore: false, oldestSeq: null });
    seqMapRef.current = new Map();
  };

  const updateSeqMap = (dtos: MessageDto[]) => {
    for (const dto of dtos) {
      seqMapRef.current.set(dto.id, dto.seq);
    }
  };

  const prevMessagesRef = useRef<ChatUIMessage[]>([]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prev = prevMessagesRef.current;
    prevMessagesRef.current = messages;
    const prependedHistory =
      prev.length > 0 && messages.length > prev.length && messages[0]?.id !== prev[0]?.id;
    const lastMessageChanged = messages.at(-1)?.id !== prev.at(-1)?.id;
    const streamingAssistant = status === "streaming" && messages.at(-1)?.role === "assistant";

    const scrollBehavior = messageScrollBehavior({
      following: followBottomRef.current,
      openingConversation: isOpeningRef.current,
      previousLength: prev.length,
      prependedHistory,
      lastMessageChanged,
      streamingAssistant,
    });
    if (scrollBehavior) {
      el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior });
    }
  }, [messages, status]);

  // Tạm dừng tự cuộn theo stream khi người dùng rời cuối danh sách; chỉ tiếp tục khi họ thật sự quay lại cuối.
  // showList tháo rồi tạo lại viewport nên cần làm mới listener cho phần tử mới.
  useEffect(() => {
    if (showList) return;
    const el = scrollRef.current;
    if (!el) return;
    const updateFollowState = () => {
      followBottomRef.current = isScrollAtBottom(el);
    };
    updateFollowState();
    el.addEventListener("scroll", updateFollowState, { passive: true });
    return () => el.removeEventListener("scroll", updateFollowState);
  }, [showList]);

  // Khi openCommand.nonce đổi, dừng stream hiện tại trước rồi tải lịch sử và đặt lại messages.
  // Chỉ nghe lệnh dùng một lần openCommand; activeConversationId còn đổi khi gửi tin được xác nhận,
  // nên nghe nó sẽ tải lại sai sau khi gửi. resolveOpenCommandTarget bỏ lệnh cũ thuộc context khác.
  // Dùng chuỗi contextKey ổn định: ReaderView tạo object context mới mỗi lần render;
  // phụ thuộc vào object đó sẽ tải lại liên tục và có thể dừng stream.
  const ctxKey = contextKey(context);
  useEffect(() => {
    const conversationId = resolveOpenCommandTarget(openCommand, ctxKey);
    if (!conversationId) return;
    let cancelled = false;
    followBottomRef.current = true;
    setShowList(false); // Chọn hội thoại trong danh sách thì quay về màn hình chat.
    resetPagination();
    isOpeningRef.current = true;
    void stop();
    void window.api.chat.messages
      .listByConversation({ conversationId, limit: PAGE_SIZE })
      .then(({ messages: dtos, hasMore }) => {
        if (cancelled) return;
        updateSeqMap(dtos);
        setMessages(messagesToUI(dtos));
        setPagination({ hasMore, loadingMore: false, oldestSeq: dtos[0]?.seq ?? null });
        // Chờ React vẽ và chiều cao Streamdown/markdown ổn định rồi cuộn mượt xuống cuối một lần.
        // Stream hiện tại đã dừng nên không cạnh tranh với cuộn theo chunk.
        setTimeout(() => {
          if (cancelled) return;
          const el = scrollRef.current;
          if (el) {
            followBottomRef.current = true;
            el.scrollTo({ top: el.scrollHeight, behavior: conversationOpenScrollBehavior() });
          }
          isOpeningRef.current = false;
        }, 100);
      })
      .catch((err: unknown) => log.warn("load conversation history failed", err));
    return () => {
      cancelled = true;
      isOpeningRef.current = false;
    };
  }, [openCommand, ctxKey, stop, setMessages]);

  // Sau một lượt gửi, làm mới danh sách hội thoại để cập nhật hội thoại mới, tiêu đề và updatedAt.
  // Tải lại trang tin nhắn mới nhất từ DB để đồng bộ id UI với id đã lưu; resend có thể đổi id.
  // Vô hiệu hóa theo tiền tố ["conversations"] để khớp mọi qk.conversations(bookId).
  useEffect(() => {
    if (prevStatus.current !== "ready" && (status === "ready" || status === "error")) {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      if (activeConversationId) {
        void window.api.chat.messages
          .listByConversation({ conversationId: activeConversationId, limit: PAGE_SIZE })
          .then(({ messages: dtos, hasMore }) => {
            updateSeqMap(dtos);
            const newUis = messagesToUI(dtos);
            const oldestNewSeq = dtos[0]?.seq ?? null;
            setMessages((prev) => {
              if (oldestNewSeq == null) return newUis;
              const kept = prev.filter(
                (m) => (seqMapRef.current.get(m.id) ?? Infinity) < oldestNewSeq,
              );
              return [...kept, ...newUis];
            });
            setPagination((p) => ({
              ...p,
              // Nếu đã tải hết lịch sử, đồng bộ trang mới nhất không được bật lại hasMore.
              hasMore: p.hasMore ? hasMore : false,
              oldestSeq: dtos[0]?.seq ?? p.oldestSeq,
            }));
          })
          .catch((err: unknown) => log.warn("reload conversation after turn failed", err));
      }
    }
    prevStatus.current = status;
  }, [status, qc, activeConversationId, setMessages]);

  // Khi active rỗng vì mở hoặc đổi sách không có hội thoại, xóa nội dung bảng; rỗng sẵn thì bỏ qua.
  useEffect(() => {
    if (activeConversationId === null) {
      setMessages([]);
      resetPagination();
    }
  }, [activeConversationId, setMessages]);

  const newConversation = async () => {
    try {
      // Tạo hội thoại rỗng theo spec §2/§7; main process tái dùng hội thoại rỗng cũ để tránh tích tụ.
      const convo = await window.api.chat.conversations.create({
        bookId: context.kind === "book" ? context.bookId : null,
      });
      setMessages([]);
      setShowList(false); // Sau khi tạo, quay về màn hình chat.
      useChatStore.getState().setActiveConversation(context, convo.id);
      openPanelAndFocusComposer();
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      log.warn("create conversation failed", err);
    }
  };

  const loadMore = () => {
    const conversationId = activeConversationId;
    const beforeSeq = pagination.oldestSeq;
    if (
      isOpeningRef.current ||
      !conversationId ||
      beforeSeq == null ||
      pagination.loadingMore ||
      !pagination.hasMore
    ) {
      return;
    }

    // Trước khi tải thêm, ghi khoảng cách từ tin nhắn nhìn thấy đầu tiên tới đỉnh viewport.
    // Khôi phục khoảng cách đó sau khi tải để tránh nhảy vị trí và kích hoạt loadMore liên tục.
    const el = scrollRef.current;
    const anchorId = messages[0]?.id;
    const anchorEl = anchorId
      ? (el?.querySelector(`[data-message-id="${anchorId}"]`) as HTMLElement | null)
      : null;
    const anchorOffset = anchorEl && el ? anchorEl.offsetTop - el.scrollTop : null;

    setPagination((p) => ({ ...p, loadingMore: true }));
    void window.api.chat.messages
      .listByConversation({ conversationId, beforeSeq, limit: PAGE_SIZE })
      .then(({ messages: dtos, hasMore }) => {
        if (dtos.length === 0) {
          setPagination((p) => ({ ...p, hasMore: false, loadingMore: false }));
          return;
        }
        updateSeqMap(dtos);
        const newUis = messagesToUI(dtos);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueNew = newUis.filter((m) => !existingIds.has(m.id));
          return [...uniqueNew, ...prev];
        });
        setPagination({
          hasMore,
          loadingMore: false,
          oldestSeq: dtos[0]?.seq ?? beforeSeq,
        });
        // Giữ tin nhắn vốn ở đầu viewport tại đúng vị trí cũ.
        requestAnimationFrame(() => {
          const newEl = scrollRef.current;
          if (anchorOffset == null || !anchorId || !newEl) return;
          const newAnchorEl = newEl.querySelector(
            `[data-message-id="${anchorId}"]`,
          ) as HTMLElement | null;
          if (!newAnchorEl) return;
          newEl.scrollTop = newAnchorEl.offsetTop - anchorOffset;
        });
      })
      .catch((err: unknown) => {
        setPagination((p) => ({ ...p, loadingMore: false }));
        log.warn("load older messages failed", err);
      });
  };

  // Tải một trang lịch sử cũ hơn khi cuộn gần tới đầu danh sách.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pagination.hasMore || pagination.loadingMore) return;
    const onScroll = () => {
      if (el.scrollTop < SCROLL_TOP_THRESHOLD) {
        loadMore();
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pagination.hasMore, pagination.loadingMore, pagination.oldestSeq, activeConversationId]);

  const actions: ChatActions = {
    regenerate: (a) => {
      followBottomRef.current = true;
      void ensureAiDataConsent().then((allowed) => {
        if (allowed) void regenerate({ messageId: a.id });
      });
    },
    resend: (u) => {
      followBottomRef.current = true;
      const aId = nextAssistantId(messages, u.id);
      void ensureAiDataConsent().then((allowed) => {
        if (allowed) void regenerate(aId ? { messageId: aId } : undefined);
      });
    },
    editAndResend: (u, newText) => {
      followBottomRef.current = true;
      void ensureAiDataConsent().then((allowed) => {
        if (!allowed) return;
        flushSync(() =>
          setMessages((ms) =>
            ms.map((m) => (m.id === u.id ? { ...m, parts: [{ type: "text", text: newText }] } : m)),
          ),
        );
        const aId = nextAssistantId(messages, u.id);
        void regenerate(aId ? { messageId: aId } : undefined);
      });
    },
    busy: status === "streaming" || status === "submitted",
  };

  const handleSend = async (text: string, chips: Chip[]): Promise<boolean> => {
    if (!(await ensureAiDataConsent())) return false;
    followBottomRef.current = true;
    void sendMessage({
      text,
      metadata: { contextChips: chips, createdAt: Temporal.Now.instant().epochMilliseconds },
    });
    return true;
  };

  return (
    <div className="flex h-full flex-col bg-muted/30 font-sans">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-semibold">
            {t("ai.panelTitle", "{{name}}", { name: agentName })}
          </span>
          {activeTitle && (
            <span className="truncate text-[11px] text-muted-foreground">{activeTitle}</span>
          )}
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowList((v) => !v)}
            aria-label={t("ai.conversationList", "Danh sách cuộc trò chuyện")}
            aria-pressed={showList}
            className={showList ? "text-foreground" : "text-muted-foreground"}
          >
            <MessagesSquare />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void newConversation()}
            aria-label={t("ai.newConversation", "Cuộc trò chuyện mới")}
            className="text-muted-foreground"
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={t("ai.closePanel", "Đóng bảng")}
            className="text-muted-foreground"
          >
            <X />
          </Button>
        </div>
      </header>

      {showList ? (
        <div className="min-h-0 flex-1">
          <ConversationsTab context={context} />
        </div>
      ) : (
        <>
          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={scrollRef}
            viewportClassName="ai-messages-viewport"
          >
            <div className="p-4">
              <ChatActionsContext.Provider value={actions}>
                <MessageList
                  messages={messages}
                  status={status}
                  bookId={bookId}
                  hasMore={pagination.hasMore}
                  loadingMore={pagination.loadingMore}
                />
              </ChatActionsContext.Provider>
            </div>
          </ScrollArea>

          {error && (
            <div className="shrink-0 border-t border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t("ai.sendFailed", "Gửi thất bại: {{message}}", { message: error.message })}
              <span className="text-muted-foreground">
                {t("ai.sendFailedHint", "(Kiểm tra API key và model trong phần Cài đặt.)")}
              </span>
            </div>
          )}

          <Composer status={status} onStop={stop} onSend={handleSend} />
        </>
      )}
      {import.meta.env.DEV && <ChatPerfMonitor messages={messages} />}
    </div>
  );
}
