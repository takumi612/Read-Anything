import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import { ChipBar } from "#/components/ai-panel/ChipBar";
import { useReaderAI } from "#/reader-ai-context";

export function Composer() {
  const { t } = useTranslation();
  const {
    draftChips,
    draftText,
    setDraftText,
    sendDraft,
    isStreaming,
    stop,
    focusNonce,
    panelOpen,
  } = useReaderAI();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Chỉ đặt tiêu điểm khi bảng luôn hiển thị: ở trạng thái thu gọn, Composer được kết xuất trong PeekDrawer đã dịch ra ngoài màn hình,
    // gọi .focus() sẽ kích hoạt scroll-into-view và làm rối quá trình vẽ transform của ngăn kéo ngoài màn hình (bản vẽ cũ,
    // khiến cột bên phải vẫn nằm nguyên vị trí và che nội dung sau khi thu gọn). preventScroll là lớp bảo vệ bổ sung để việc đặt tiêu điểm bằng mã không kéo theo cuộn.
    if (focusNonce > 0 && panelOpen) ref.current?.focus({ preventScroll: true });
  }, [focusNonce, panelOpen]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      sendDraft();
    }
  };

  const empty = draftText.trim() === "" && draftChips.length === 0;

  return (
    <div className="shrink-0 border-t border-border bg-card/40 p-3">
      {draftChips.length > 0 && (
        <div className="mb-2">
          <ChipBar chips={draftChips} />
        </div>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
        <textarea
          ref={ref}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t("composer.placeholder")}
          className="no-scrollbar max-h-32 min-h-9 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        {isStreaming ? (
          <Button size="icon" variant="secondary" onClick={stop} aria-label={t("composer.stop")}>
            <Square className="size-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={sendDraft} disabled={empty} aria-label={t("composer.send")}>
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
