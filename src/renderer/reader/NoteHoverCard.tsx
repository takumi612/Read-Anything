import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useNoteHoverStore } from "@renderer/store/note-hover-store";
import { HoverCard, HoverCardContent } from "@renderer/components/ui/hover-card";
import { Button } from "@renderer/components/ui/button";

/**
 * Thẻ hiện khi rê lên vùng tô sáng có ghi chú; note-hover-store quản lý đóng mở.
 * Neo ảo với tọa độ khung nhìn và positionMethod="fixed" đặt thẻ cạnh vùng tô sáng.
 * Người dùng có thể đưa chuột vào thẻ để đọc ghi chú dài hoặc chọn sửa; store quản lý timer đóng.
 */
export function NoteHoverCard() {
  const { t } = useTranslation();
  const bookId = useNavigationStore((s) => s.currentBookId);
  const annoId = useNoteHoverStore((s) => s.annoId);
  const anchorRect = useNoteHoverStore((s) => s.anchorRect);
  const open = useNoteHoverStore((s) => s.open);
  const enterCard = useNoteHoverStore((s) => s.enterCard);
  const leaveCard = useNoteHoverStore((s) => s.leaveCard);
  const closeNow = useNoteHoverStore((s) => s.closeNow);
  const openNoteModal = useAnnotationStore((s) => s.openNoteModal);

  const annos = useQuery({
    queryKey: qk.annotations(bookId ?? ""),
    queryFn: () => window.api.annotations.listByBook({ bookId: bookId! }),
    enabled: bookId != null,
  });
  const anno = annoId ? annos.data?.find((a) => a.id === annoId) : undefined;

  // Bọc rect theo tọa độ khung nhìn thành VirtualElement cho floating-ui.
  const anchor = anchorRect
    ? {
        getBoundingClientRect: () => {
          const r = anchorRect;
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            top: r.y,
            left: r.x,
            right: r.x + r.width,
            bottom: r.y + r.height,
            toJSON() {},
          } as DOMRect;
        },
      }
    : undefined;

  if (!anno || !anchor) return null;

  return (
    <HoverCard
      open={open}
      onOpenChange={(next) => {
        if (!next) closeNow();
      }}
    >
      <HoverCardContent
        anchor={anchor}
        positionMethod="fixed"
        side="top"
        align="start"
        onMouseEnter={enterCard}
        onMouseLeave={leaveCard}
      >
        {anno.note && (
          <div className="no-scrollbar max-h-40 overflow-y-auto whitespace-pre-wrap text-popover-foreground">
            {anno.note}
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={() => {
              const id = annoId;
              closeNow();
              if (id) openNoteModal({ target: { type: "edit", annotationId: id } });
            }}
          >
            <Pencil className="size-3.5" />
            {t("reader.note.edit", "Sửa")}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
