import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownLeft } from "lucide-react";
import { Kbd, KbdGroup, ModKey } from "@renderer/components/ui/kbd";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Textarea } from "@renderer/components/ui/textarea";
import { Button } from "@renderer/components/ui/button";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { usePrefsStore } from "@renderer/store/prefs-store";

/** Hộp ghi chú ở giữa: tạo từ vùng chọn với màu vàng mặc định hoặc sửa chú thích có sẵn. */
export function NoteModal() {
  const { t } = useTranslation();
  const noteModal = useAnnotationStore((s) => s.noteModal);
  const closeNoteModal = useAnnotationStore((s) => s.closeNoteModal);
  const setSelection = useAnnotationStore((s) => s.setSelection);
  const lastStyle = usePrefsStore((s) => s.lastHighlightStyle);
  const bookId = useNavigationStore((s) => s.currentBookId);
  const qc = useQueryClient();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState("");

  const annos = useQuery({
    queryKey: qk.annotations(bookId ?? ""),
    queryFn: () => window.api.annotations.listByBook({ bookId: bookId! }),
    enabled: bookId != null,
  });

  const editing = noteModal?.target.type === "edit" ? noteModal.target.annotationId : null;
  const current = editing ? annos.data?.find((a) => a.id === editing) : undefined;
  // Hiện đoạn gốc trong hộp: khi tạo dùng ảnh chụp điểm neo lúc mở, khi sửa dùng dữ liệu chú thích.
  const quote = editing ? current?.selectedText : noteModal?.anchor?.selectedText;

  // Khi mở, nạp ghi chú cũ nếu sửa, để trống nếu tạo, rồi focus.
  // Chỉ phụ thuộc noteModal và editing vì mỗi lần mở tạo object noteModal mới nên effect luôn chạy lại.
  // Thêm current hoặc text vào dependency có thể ghi đè nội dung người dùng đang nhập.
  useEffect(() => {
    if (!noteModal) return;
    setText(editing ? (current?.note ?? "") : "");
    taRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteModal, editing]);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.annotations(bookId ?? "") });
  const createM = useMutation({ mutationFn: window.api.annotations.create, onSuccess: invalidate });
  const updateM = useMutation({ mutationFn: window.api.annotations.update, onSuccess: invalidate });

  if (!noteModal || bookId == null) return null;

  // Khi hủy hoặc nhấn nền, xóa cả vùng chọn để thanh công cụ không hiện lại sau khi đóng hộp.
  const dismiss = () => {
    closeNoteModal();
    setSelection(null);
  };

  const save = () => {
    if (noteModal.target.type === "create") {
      // Dùng điểm neo chụp lúc mở thay cho store.selection có thể đổi; thiếu neo thì không tạo ghi chú.
      const anchor = noteModal.anchor;
      if (!anchor) return;
      createM.mutate({
        bookId,
        style: lastStyle,
        note: text,
        selectedText: anchor.selectedText,
        locatorRange: anchor.locatorRange,
      });
      setSelection(null);
    } else {
      updateM.mutate({ id: noteModal.target.annotationId, patch: { note: text } });
    }
    closeNoteModal();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Esc, nhấn nền hoặc nút X đều đóng hộp và xóa vùng chọn.
        if (!open) dismiss();
      }}
    >
      <DialogContent className="font-sans sm:max-w-[36rem]">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("reader.note.editTitle", "Sửa ghi chú")
              : t("reader.note.addTitle", "Thêm ghi chú")}
          </DialogTitle>
        </DialogHeader>
        {quote && (
          <blockquote className="line-clamp-2 border-s-2 border-border ps-3 font-serif text-sm italic leading-snug text-muted-foreground">
            {quote}
          </blockquote>
        )}
        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Cmd trên macOS hoặc Ctrl trên Windows/Linux cùng Enter để lưu.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          placeholder={t("reader.note.placeholder", "Viết suy nghĩ của bạn…")}
          className="no-scrollbar min-h-40 resize-none leading-relaxed"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            {t("common.cancel", "Hủy")}
          </Button>
          <Button onClick={save}>
            {t("common.save", "Lưu")}
            <KbdGroup>
              <ModKey className="border-transparent bg-primary-foreground/20 text-primary-foreground" />
              <Kbd className="border-transparent bg-primary-foreground/20 text-primary-foreground">
                <CornerDownLeft className="size-3" />
              </Kbd>
            </KbdGroup>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
