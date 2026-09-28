import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Chip } from "#/mock/types";
import { ScrollArea } from "#/components/ScrollArea";

interface HoverState {
  chip: Chip;
  rect: DOMRect;
}

const POPOVER_WIDTH = 320;

/** Thanh chip phía trên ô nhập: mỗi chip selection và paragraph là một **thẻ nhỏ**,
 *  trong thẻ hiển thị nhãn + số token + **bản xem trước nội dung bị cắt trên một dòng**; di chuột lên thẻ → hiện toàn văn phía trên
 *  (kết xuất bằng portal, giữ trong khung nhìn, thanh cuộn mảnh tự vẽ, lớp nổi có thể cuộn khi rê chuột, không chiếm chỗ bố cục).
 *  Trong Phase 1, cả hai đều bắt buộc (biểu tượng khóa). */
export function ChipBar({ chips }: { chips: Chip[] }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoverState | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(null), 160);
  };

  if (chips.length === 0) return null;

  return (
    <div className="flex gap-1.5">
      {chips.map((chip) => (
        <div
          key={chip.id}
          onMouseEnter={(e) => {
            cancelClose();
            setHover({ chip, rect: e.currentTarget.getBoundingClientRect() });
          }}
          onMouseLeave={scheduleClose}
          className="min-w-0 flex-1 cursor-default rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 transition-colors hover:bg-muted"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">{t(chip.labelKey)}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              ≈{chip.tokenCount} tok
            </span>
            {chip.required && <Lock className="ml-auto size-3 shrink-0 text-muted-foreground/70" />}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{chip.content}</div>
        </div>
      ))}
      {hover && <ChipPopover hover={hover} onEnter={cancelClose} onLeave={scheduleClose} />}
    </div>
  );
}

function ChipPopover({
  hover,
  onEnter,
  onLeave,
}: {
  hover: HoverState;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  if (typeof document === "undefined") return null;

  const { chip, rect } = hover;
  const vw = window.innerWidth;
  const left = Math.min(Math.max(rect.left, 12), vw - POPOVER_WIDTH - 12);
  const bottom = window.innerHeight - rect.top + 8; // Mép dưới lớp nổi cách phía trên thẻ 8px; lớp nổi mở rộng lên trên

  return createPortal(
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: "fixed", left, bottom, zIndex: 60 }}
      className="w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
    >
      <ScrollArea viewportClassName="max-h-40">
        <div className="p-3 text-xs leading-relaxed">
          <div className="mb-1 font-medium text-foreground">
            {t("chip.willSend", { label: t(chip.labelKey) })}
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{chip.content}</p>
          {chip.required && (
            <div className="mt-2 text-[11px] text-muted-foreground/70">
              {t("chip.requiredNote")}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>,
    document.body,
  );
}
