import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BookNoteDto } from "@shared/book-notes";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import { LocalizedStreamdown } from "@renderer/components/LocalizedStreamdown";
import { qk } from "@renderer/query/keys";
import { bookNotesQuery } from "@renderer/query/book-note-queries";
import { relativeTime } from "@renderer/lib/relative-time";
import { BookNoteEditor, type BookNoteEditorState } from "./BookNoteEditor";
import { ClearBookCategoryButton } from "@renderer/reader/ClearBookCategoryButton";

/** Bảng ghi chú riêng cho từng sách, dùng chung ở tab thanh bên và hộp xem ghi chú trong thư viện. */
export function BookNotesPanel({ bookId }: { bookId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const notes = useQuery(bookNotesQuery(bookId));
  const [editor, setEditor] = useState<BookNoteEditorState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: qk.bookNotes(bookId) });
  const createM = useMutation({
    mutationFn: window.api.bookNotes.create,
    onSuccess: invalidate,
    onError: (e) => {
      // Hiện lỗi thật từ main process và giữ toast cho tới khi người dùng đóng.
      toast.error(
        t("bookNotes.createError", "Không thể lưu ghi chú: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });
  const updateM = useMutation({
    mutationFn: window.api.bookNotes.update,
    onSuccess: invalidate,
    onError: (e) => {
      // Hiện lỗi thật từ main process và giữ toast cho tới khi người dùng đóng.
      toast.error(
        t("bookNotes.updateError", "Không thể cập nhật ghi chú: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });
  const deleteM = useMutation({
    mutationFn: window.api.bookNotes.delete,
    onSuccess: invalidate,
    onError: (e) => {
      // Hiện lỗi thật từ main process và giữ toast cho tới khi người dùng đóng.
      toast.error(
        t("bookNotes.deleteError", "Không thể xóa ghi chú: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    },
  });

  const save = (content: string) => {
    if (editor?.mode === "edit") updateM.mutate({ id: editor.noteId, patch: { content } });
    else createM.mutate({ bookId, content });
  };

  const now = Date.now();

  // Khi sửa, toàn bộ vùng thành editor cao hết khung, cạnh bảng AI để vẫn xem và sao chép hội thoại.
  if (editor) {
    return <BookNoteEditor state={editor} onSave={save} onClose={() => setEditor(null)} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-2 pb-0">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1"
            onClick={() => setEditor({ mode: "create" })}
          >
            <Plus />
            {t("bookNotes.add", "Ghi chú mới")}
          </Button>
          <ClearBookCategoryButton
            bookId={bookId}
            category="notes"
            count={notes.data?.length ?? 0}
            iconOnly
          />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {notes.isPending ? (
          <p className="p-3 text-sm text-muted-foreground">{t("bookNotes.loading", "Đang tải ghi chú…")}</p>
        ) : notes.isError ? (
          <p className="p-3 text-sm text-destructive">{t("bookNotes.loadError", "Không thể tải ghi chú")}</p>
        ) : (notes.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {t("bookNotes.empty", "Chưa có ghi chú. Hãy viết ý nghĩ đầu tiên về cuốn sách này.")}
          </p>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1.5 p-2">
              {(notes.data ?? []).map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  time={relativeTime(n.createdAt, now, i18n.language)}
                  onEdit={() =>
                    setEditor({ mode: "edit", noteId: n.id, initialContent: n.content })
                  }
                  onDelete={() => setConfirmDeleteId(n.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("bookNotes.deleteConfirm.title", "Xóa ghi chú này?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("bookNotes.deleteConfirm.body", "Bạn không thể hoàn tác thao tác này.")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              {t("common.cancel", "Hủy")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId) deleteM.mutate({ id: confirmDeleteId });
                setConfirmDeleteId(null);
              }}
            >
              {t("bookNotes.deleteConfirm.confirm", "Xóa")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NoteItem({
  note,
  time,
  onEdit,
  onDelete,
}: {
  note: BookNoteDto;
  time: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group rounded-lg border border-border bg-background/60 p-2.5">
      <div className="text-xs leading-relaxed">
        <LocalizedStreamdown>{note.content}</LocalizedStreamdown>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/70">{time}</span>
        <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("bookNotes.edit", "Sửa")}
            onClick={onEdit}
            className="text-muted-foreground"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("bookNotes.delete", "Xóa")}
            onClick={onDelete}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>
    </div>
  );
}
