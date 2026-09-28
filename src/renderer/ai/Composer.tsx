import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatStatus } from "ai";
import { ArrowUp, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Chip } from "@shared/chat";
import { Button } from "@renderer/components/ui/button";
import { isSubmitEnter } from "@renderer/lib/keyboard";
import { useChatStore } from "@renderer/store/chat-store";
import { registerComposerFocus } from "@renderer/ai/composer-focus";
import { ContextPillBar } from "@renderer/ai/ContextPillBar";
import { toast } from "sonner";

interface Props {
  status: ChatStatus;
  onSend: (text: string, chips: Chip[]) => Promise<boolean>;
  onStop: () => void;
}

export function Composer({ status, onSend, onStop }: Props) {
  const { t } = useTranslation();
  const draftText = useChatStore((s) => s.draftText);
  const draftChips = useChatStore((s) => s.draftChips);
  const setDraftText = useChatStore((s) => s.setDraftText);
  const setDraftChips = useChatStore((s) => s.setDraftChips);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const isStreaming = status === "streaming" || status === "submitted";
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    registerComposerFocus(() => {
      const el = ref.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      // Đặt con trỏ ở cuối để có thể gửi ngay hoặc viết thêm sau prompt preset.
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
    return () => registerComposerFocus(null);
  }, []);

  const send = async () => {
    const text = draftText.trim();
    if (!text || isStreaming || confirming) return;
    setConfirming(true);
    let accepted = false;
    try {
      accepted = await onSend(text, draftChips);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      return;
    } finally {
      setConfirming(false);
    }
    if (!accepted) return;
    setDraftText("");
    setDraftChips([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitEnter(e)) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-card/40 p-3">
      <ContextPillBar />
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={ref}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t("ai.composer.placeholder", "Bạn muốn hỏi gì? (Enter để gửi, Shift+Enter để xuống dòng)")}
          className="max-h-32 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        {isStreaming ? (
          <Button
            variant="secondary"
            size="icon-lg"
            onClick={onStop}
            aria-label={t("ai.stop", "Dừng")}
          >
            <Square />
          </Button>
        ) : (
          <Button
            size="icon-lg"
            onClick={() => void send()}
            disabled={draftText.trim() === "" || confirming}
            aria-label={t("ai.send", "Gửi")}
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  );
}
