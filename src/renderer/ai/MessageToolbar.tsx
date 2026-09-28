import { Pencil, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { CopyButton } from "@renderer/ai/CopyButton";
import { useChatActions } from "@renderer/ai/chat-actions";
import { textOf } from "@renderer/ai/message-text";
import type { ChatUIMessage } from "@renderer/ai/types";

/** Hàng thao tác hiện dưới tin khi rê hoặc focus: sao chép và sửa/gửi lại/tạo lại theo vai trò. */
export function MessageToolbar({ m, onEdit }: { m: ChatUIMessage; onEdit?: () => void }) {
  const { t } = useTranslation();
  const actions = useChatActions();
  return (
    <div role="toolbar" aria-label={t("ai.messageActions", "Thao tác tin nhắn")} className="flex gap-0.5">
      <CopyButton text={textOf(m)} />
      {m.role === "user" && (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("ai.edit", "Sửa")}
            onClick={onEdit}
            disabled={actions.busy}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("ai.resend", "Gửi lại")}
            onClick={() => actions.resend(m)}
            disabled={actions.busy}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </>
      )}
      {m.role === "assistant" && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("ai.regenerate", "Tạo lại")}
          onClick={() => actions.regenerate(m)}
          disabled={actions.busy}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
