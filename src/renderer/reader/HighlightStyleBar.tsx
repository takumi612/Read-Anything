import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Underline } from "lucide-react";
import type { AnnotationStyle } from "@shared/annotations";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { annotationColorHex } from "./annotation-colors";

/** Thanh chỉnh màu đang bật và gạch dưới; mở từ vùng tô sáng có sẵn để sửa, ghi chú hoặc xóa. */
export function HighlightStyleBar() {
  const { t } = useTranslation();
  const styleBar = useAnnotationStore((s) => s.styleBar);
  const closeStyleBar = useAnnotationStore((s) => s.closeStyleBar);
  const openNoteModal = useAnnotationStore((s) => s.openNoteModal);
  const setSelection = useAnnotationStore((s) => s.setSelection);
  const setLastHighlightStyle = usePrefsStore((s) => s.setLastHighlightStyle);
  const palette = usePrefsStore((s) => s.annotationPalette);
  const bookId = useNavigationStore((s) => s.currentBookId);
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement | null>(null);

  const annos = useQuery({
    queryKey: qk.annotations(bookId ?? ""),
    queryFn: () => window.api.annotations.listByBook({ bookId: bookId! }),
    enabled: bookId != null,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.annotations(bookId ?? "") });
  const updateM = useMutation({
    mutationFn: window.api.annotations.update,
    onSuccess: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: window.api.annotations.delete,
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!styleBar) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Nhấn ngoài thanh thì đóng và xóa vùng chọn; nhấn ở tài liệu chính không tự thu vùng chọn trong iframe.
        // Nếu store.selection còn, thanh công cụ chính sẽ hiện lại.
        closeStyleBar();
        setSelection(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [styleBar, closeStyleBar, setSelection]);

  if (!styleBar || bookId == null) return null;
  const editing = styleBar.target.type === "edit" ? styleBar.target.annotationId : null;
  const current = editing ? annos.data?.find((a) => a.id === editing) : undefined;

  const pickStyle = (style: AnnotationStyle) => {
    // Chỉ mở thanh kiểu ở chế độ sửa vì công cụ tô sáng tạo chú thích ngay trước đó.
    if (styleBar.target.type !== "edit") return;
    setLastHighlightStyle(style); // Nhớ kiểu này để áp dụng ngay cho lần tô sáng sau.
    updateM.mutate({ id: styleBar.target.annotationId, patch: { style } });
    closeStyleBar();
  };

  const { rect } = styleBar;
  const left = Math.min(Math.max(rect.x + rect.width / 2, 160), window.innerWidth - 160);
  const top = rect.y - 8;

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.preventDefault()}
      style={{ position: "fixed", left, top, transform: "translate(-50%, -100%)", zIndex: 55 }}
      className="flex w-max items-center gap-1.5 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
    >
      {palette.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={t("reader.highlight.colorLabel", "Đánh dấu {{color}}", { color: c })}
          onClick={() => pickStyle(c)}
          style={{ backgroundColor: annotationColorHex(c) }}
          className={cn(
            "size-5 rounded-full ring-offset-1 ring-offset-popover transition",
            current?.style === c ? "ring-2 ring-foreground/60" : "hover:scale-110",
          )}
        />
      ))}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("reader.highlight.underline", "Gạch chân")}
        onClick={() => pickStyle("underline")}
        className={cn(current?.style === "underline" && "bg-muted ring-1 ring-foreground/40")}
      >
        <Underline className="size-4" />
      </Button>
      {editing && (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("reader.note.label", "Ghi chú")}
            onClick={() => {
              openNoteModal({ target: { type: "edit", annotationId: editing } });
              closeStyleBar();
            }}
            className="text-muted-foreground"
          >
            <StickyNoteIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("reader.annotation.delete", "Xóa")}
            onClick={() => {
              deleteM.mutate({ id: editing });
              closeStyleBar();
            }}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function StickyNoteIcon() {
  return <span className="text-xs">✎</span>;
}
