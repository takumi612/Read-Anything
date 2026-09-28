import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ConversationDto } from "@shared/chat";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import {
  useChatStore,
  getActiveConversationId,
  useActiveConversationId,
} from "@renderer/store/chat-store";
import { relativeTime } from "@renderer/lib/relative-time";
import { conversationsQuery } from "@renderer/query/conversation-queries";
import { qk } from "@renderer/query/keys";
import { type ChatContext, contextKey } from "@renderer/ai/chat-context";

export function ConversationsTab({ context }: { context: ChatContext }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const key = contextKey(context);
  const activeId = useActiveConversationId(context);
  const openConversation = useChatStore((s) => s.openConversation);
  const convos = useQuery(conversationsQuery(context));
  const [confirmTarget, setConfirmTarget] = useState<ConversationDto | null>(null);

  // Main process dừng stream và xóa tin liên quan; thành công thì xóa active, làm mới danh sách và hiện toast.
  const deleteConvo = useMutation({
    mutationFn: (c: ConversationDto) => window.api.chat.conversations.delete({ id: c.id }),
    onSuccess: (_r, c) => {
      // Xóa active trước để cửa sổ không gửi vào hội thoại đã xóa, rồi làm mới danh sách.
      // Quay về trạng thái hội thoại mới rỗng; effect của AIPanel sẽ dọn bảng.
      const s = useChatStore.getState();
      if (getActiveConversationId(context) === c.id) {
        s.setActiveConversation(context, null);
      }
      // Xóa cache tin nhắn của hội thoại, không refetch vì hội thoại đã không còn.
      qc.removeQueries({ queryKey: qk.messages(c.id) });
      void qc.invalidateQueries({ queryKey: qk.conversations(key) });
      toast.success(t("reader.conversation.deleted", "Đã xóa cuộc trò chuyện"));
    },
    onError: (e) => {
      // Hiển thị lỗi thật từ main process và giữ toast cho tới khi người dùng đóng.
      toast.error(
        t("reader.conversation.deleteFailed", "Không thể xóa: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });

  if (convos.isPending)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {t("reader.conversation.loading", "Đang tải cuộc trò chuyện…")}
      </p>
    );
  if (convos.isError)
    return (
      <p className="p-3 text-sm text-destructive">
        {t("reader.conversation.loadError", "Không thể tải cuộc trò chuyện")}
      </p>
    );
  const list = convos.data ?? [];
  if (list.length === 0)
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        {context.kind === "library"
          ? t("ai.conversation.libraryEmpty", "Chưa có cuộc trò chuyện nào. Hãy bắt đầu một cuộc trò chuyện.")
          : t("reader.conversation.empty", "Chưa có cuộc trò chuyện. Hãy chọn một đoạn và hỏi AI.")}
      </p>
    );

  const primaryLabel = (c: ConversationDto): string =>
    c.title?.trim() ? c.title : t("reader.conversation.untitled", "Cuộc trò chuyện chưa đặt tên");
  const now = Date.now();

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-1 p-2">
          {list.map((c) => (
            <ConversationRow
              key={c.id}
              convo={c}
              active={c.id === activeId}
              label={primaryLabel(c)}
              time={relativeTime(c.updatedAt, now, i18n.language)}
              onOpen={() => openConversation(context, c.id)}
              onDeleteRequest={() => setConfirmTarget(c)}
            />
          ))}
        </div>
      </ScrollArea>

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("reader.conversation.deleteConfirm.title", "Xóa cuộc trò chuyện “{{title}}”?", {
              title: confirmTarget ? primaryLabel(confirmTarget) : "",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "reader.conversation.deleteConfirm.body",
              "Cuộc trò chuyện và tất cả tin nhắn sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác thao tác này.",
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>
              {t("reader.conversation.deleteConfirm.cancel", "Hủy")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmTarget) deleteConvo.mutate(confirmTarget);
                setConfirmTarget(null);
              }}
            >
              {t("reader.conversation.deleteConfirm.confirm", "Xóa")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Một dòng hội thoại có nút mở, nút xóa khi rê và menu chuột phải; cả hai cách xóa dùng chung xác nhận. */
function ConversationRow({
  convo,
  active,
  label,
  time,
  onOpen,
  onDeleteRequest,
}: {
  convo: ConversationDto;
  active: boolean;
  label: string;
  time: string;
  onOpen: () => void;
  onDeleteRequest: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="group relative" />}>
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-transparent p-2 text-start",
            active ? "bg-accent" : "hover:bg-muted",
          )}
        >
          <MessagesSquare className="size-4 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              convo.isNaming ? "animate-pulse text-muted-foreground" : "text-foreground",
            )}
          >
            {label}
          </span>
          {/* Dùng opacity để giữ chỗ, tránh chiều rộng dòng nhảy khi rê chuột. */}
          <span className="shrink-0 text-[10px] text-muted-foreground/70 group-hover:opacity-0">
            {time}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDeleteRequest}
          aria-label={t("reader.conversation.deleteAction", "Xóa cuộc trò chuyện")}
          // Căn giữa bằng inset-y-0 và my-auto thay cho translate; trạng thái active của Button
          // cũng dùng translate nên có thể đẩy nút khỏi con trỏ trước mouseup, làm mất click.
          className="absolute end-1 inset-y-0 z-10 my-auto hidden text-muted-foreground hover:text-destructive group-hover:flex"
        >
          <Trash2 />
        </Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem variant="destructive" onClick={onDeleteRequest}>
          {t("reader.conversation.menu.delete", "Xóa")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
