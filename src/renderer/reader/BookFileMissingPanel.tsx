import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { FileX2 } from "lucide-react";
import { toast } from "sonner";
import { qk } from "@renderer/query/keys";
import { Button } from "@renderer/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import { useNavigationStore } from "@renderer/store/navigation-store";

/** Bảng thay vùng đọc khi thiếu tệp sách: liên kết lại sau khi kiểm tra nội dung, xóa hoặc về thư viện. */
export function BookFileMissingPanel({ bookId }: { bookId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const backToLibrary = useNavigationStore((s) => s.backToLibrary);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  const relink = async () => {
    try {
      const r = await window.api.library.relink({ bookId });
      if (r.status === "ok") {
        setMismatch(false);
        toast.success(t("reader.missingFile.relinked", "Đã kết nối lại tệp"));
        void qc.invalidateQueries({ queryKey: qk.bookBytes(bookId) });
      } else if (r.status === "mismatch") {
        setMismatch(true);
      }
      // Người dùng hủy thì không làm gì.
    } catch (e) {
      toast.error(
        t("reader.missingFile.relinkFailed", "Không thể kết nối lại: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    }
  };

  const remove = async () => {
    setConfirmOpen(false);
    try {
      await window.api.library.delete({ bookId });
      toast.success(t("reader.missingFile.deleted", "Đã gỡ khỏi thư viện"));
      backToLibrary();
    } catch (e) {
      toast.error(
        t("reader.missingFile.deleteFailed", "Xóa thất bại: {{error}}", {
          error: (e as Error).message,
        }),
        { closeButton: true, duration: Infinity },
      );
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <FileX2 className="size-12 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-sans text-base font-medium text-foreground">
          {t("reader.missingFile.title", "Không tìm thấy tệp sách")}
        </p>
        <p className="max-w-sm font-sans text-sm text-muted-foreground">
          {t(
            "reader.missingFile.body",
            "Tệp có thể đã bị di chuyển hoặc xóa. Chọn lại tệp gốc để tiếp tục đọc với tiến độ và đánh dấu đã lưu, hoặc gỡ sách khỏi thư viện.",
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void relink()}>
          {t("reader.missingFile.relink", "Chọn lại tệp")}
        </Button>
        <Button variant="outline" onClick={backToLibrary}>
          {t("reader.backToLibrary", "Thư viện")}
        </Button>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          {t("reader.missingFile.delete", "Gỡ khỏi thư viện")}
        </Button>
      </div>
      {mismatch && (
        <p className="font-sans text-sm text-destructive">
          {t("reader.missingFile.mismatch", "Đây không phải tệp gốc vì nội dung không khớp")}
        </p>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("reader.missingFile.deleteConfirm.title", "Gỡ sách này khỏi thư viện?")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "reader.missingFile.deleteConfirm.body",
              "Sách này cùng toàn bộ đánh dấu, ghi chú và cuộc trò chuyện sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác thao tác này.",
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("reader.missingFile.deleteConfirm.cancel", "Hủy")}
            </Button>
            <Button variant="destructive" onClick={() => void remove()}>
              {t("reader.missingFile.deleteConfirm.confirm", "Xóa")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
