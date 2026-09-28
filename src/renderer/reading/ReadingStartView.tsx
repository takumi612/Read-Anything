import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { BookSummaryDto } from "@shared/library";
import { Button } from "@renderer/components/ui/button";
import { CoverImage } from "@renderer/library/CoverImage";
import { createLogger } from "@renderer/logger";
import { qk } from "@renderer/query/keys";

const log = createLogger("reading");

export function ReadingStartView({ book }: { book: BookSummaryDto }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const start = async () => {
    if (pending) return;
    setPending(true);
    try {
      await window.api.readingSessions.start({ mode: "continue", bookId: book.id });
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.book(book.id) }),
        qc.invalidateQueries({ queryKey: qk.library }),
        qc.invalidateQueries({ queryKey: qk.recentlyRead }),
      ]);
    } catch (error) {
      log.warn("start reading failed", error);
      toast.error(t("readingStart.failed", "Không thể bắt đầu lượt đọc. Hãy thử lại."), {
        closeButton: true,
        duration: Infinity,
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="flex h-screen items-center justify-center bg-background p-8 font-sans">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="w-40 overflow-hidden rounded-md shadow-xl">
          <CoverImage book={book} />
        </div>
        <div>
          <p className="text-sm font-medium text-primary">
            {t("readingStart.title", "Bắt đầu lượt đọc này")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{book.title ?? book.id}</h1>
          <p className="mt-2 text-muted-foreground">
            {book.author ?? t("library.unknownAuthor", "Không rõ tác giả")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t(
              "readingStart.description",
              "Đánh dấu thời điểm bắt đầu để Read-Anything ghi lại thời gian và hoạt động của lượt đọc này.",
            )}
          </p>
        </div>
        <Button onClick={() => void start()} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {t("readingStart.action", "Bắt đầu đọc")}
        </Button>
      </div>
    </main>
  );
}
