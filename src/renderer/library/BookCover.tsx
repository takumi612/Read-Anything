import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eraser, NotebookPen, Pencil, Trash2 } from "lucide-react";
import type { BookSummaryDto } from "@shared/library";
import { Button } from "@renderer/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { Label } from "@renderer/components/ui/label";
import { CoverImage } from "./CoverImage";
import { BookNotesPanel } from "@renderer/book-notes/BookNotesPanel";

export function BookCover({
  book,
  onOpen,
  onDelete,
  onClearData,
  onUpdate,
}: {
  book: BookSummaryDto;
  onOpen: () => void;
  onDelete: () => void;
  onClearData: () => void;
  onUpdate: (patch: { title: string; author: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const fieldId = useId();

  // Khi mở, lấy dữ liệu từ snapshot sách; không điền hash id vì nó chỉ là nhãn dự phòng khi thiếu title.
  const openEdit = () => {
    setEditTitle(book.title ?? "");
    setEditAuthor(book.author ?? "");
    setEditOpen(true);
  };

  const saveEdit = () => {
    const title = editTitle.trim();
    if (!title) return;
    onUpdate({ title, author: editAuthor.trim() || null }); // Tác giả rỗng thành null để hiện nhãn chưa rõ tác giả.
    setEditOpen(false);
  };

  const title = book.title ?? book.id;
  const author = book.author ?? t("library.unknownAuthor", "Không rõ tác giả");
  const label = `${title} · ${author}`;
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              onClick={onOpen}
              aria-label={label}
              title={label}
              className="block w-full overflow-hidden rounded-md shadow-md transition-transform hover:scale-[1.03] hover:shadow-xl"
            />
          }
        >
          <CoverImage book={book} />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={openEdit}>
            <Pencil />
            {t("library.menu.edit", "Sửa thông tin")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setNotesOpen(true)}>
            <NotebookPen />
            {t("library.menu.notes", "Xem ghi chú")}
          </ContextMenuItem>
          {book.format === "pdf" && (
            <ContextMenuItem onClick={() => setClearDataOpen(true)}>
              <Eraser />
              {t("library.menu.clearPdfData")}
            </ContextMenuItem>
          )}
          <ContextMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 />
            {t("library.menu.delete", "Xóa")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("library.deleteConfirm.title", "Xóa “{{title}}”?", { title })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "library.deleteConfirm.body",
              "Sách này, toàn bộ ghi chú, đánh dấu, cuộc trò chuyện và tệp đã nhập sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác thao tác này.",
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("library.deleteConfirm.cancel", "Hủy")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              {t("library.deleteConfirm.confirm", "Xóa")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearDataOpen} onOpenChange={setClearDataOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t("library.clearPdfData.title", { title })}</AlertDialogTitle>
          <AlertDialogDescription>{t("library.clearPdfData.body")}</AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setClearDataOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setClearDataOpen(false);
                onClearData();
              }}
            >
              {t("library.menu.clearPdfData")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="font-sans sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("library.notesDialog.title", "Ghi chú · {{title}}", { title })}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[60vh]">
            <BookNotesPanel bookId={book.id} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="font-sans sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("library.editDialog.title", "Sửa thông tin sách")}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-title`}>
                {t("library.editDialog.bookTitle", "Tên sách")}
              </Label>
              <Input
                id={`${fieldId}-title`}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-author`}>{t("library.editDialog.author", "Tác giả")}</Label>
              <Input
                id={`${fieldId}-author`}
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                placeholder={t("library.editDialog.authorPlaceholder", "Để trống nếu không biết tác giả")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                {t("common.cancel", "Hủy")}
              </Button>
              <Button type="submit" disabled={editTitle.trim() === ""}>
                {t("common.save", "Lưu")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
