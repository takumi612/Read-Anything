import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReaderDataCategory } from "@shared/library";
import { Button } from "@renderer/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import { qk } from "@renderer/query/keys";

const categoryLabels: Record<ReaderDataCategory, { key: string; fallback: string }> = {
  annotations: { key: "reader.annotations", fallback: "Annotations" },
  vocabulary: { key: "reader.vocabulary", fallback: "Vocabulary" },
  bookmarks: { key: "reader.pdf.bookmarks.title", fallback: "Bookmarks" },
  notes: { key: "reader.bookNotes", fallback: "Book notes" },
};

export function ClearBookCategoryButton({
  bookId,
  category,
  count,
  iconOnly = false,
}: {
  bookId: string;
  category: ReaderDataCategory;
  count: number;
  iconOnly?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const label = t(categoryLabels[category].key, categoryLabels[category].fallback);
  const clear = useMutation({
    mutationFn: () => window.api.library.clearBookCategory({ bookId, category }),
    onSuccess: async (deletedCount) => {
      if (category === "annotations") {
        await queryClient.invalidateQueries({ queryKey: qk.annotations(bookId) });
      } else if (category === "vocabulary") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: qk.vocabulary(bookId) }),
          queryClient.invalidateQueries({ queryKey: qk.vocabularyOccurrences(bookId) }),
        ]);
      } else if (category === "bookmarks") {
        await queryClient.invalidateQueries({ queryKey: qk.pdfBookmarks(bookId) });
      } else {
        await queryClient.invalidateQueries({ queryKey: qk.bookNotes(bookId) });
      }
      setOpen(false);
      toast.success(
        t("reader.clearCategory.success", "Cleared {{count}} items from {{category}}.", {
          count: deletedCount,
          category: label,
        }),
      );
    },
    onError: (error) => {
      toast.error(
        t("reader.clearCategory.error", "Couldn't clear {{category}}.", { category: label }),
        { description: error instanceof Error ? error.message : String(error) },
      );
    },
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={iconOnly ? "icon-sm" : "sm"}
        className="shrink-0 text-destructive hover:text-destructive"
        aria-label={t("reader.clearCategory.buttonLabel", "Clear all {{category}}", {
          category: label,
        })}
        title={t("reader.clearCategory.buttonLabel", "Clear all {{category}}", {
          category: label,
        })}
        disabled={count === 0 || clear.isPending}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
        {!iconOnly && t("reader.clearCategory.button", "Clear all")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!clear.isPending) setOpen(nextOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t("reader.clearCategory.title", "Clear {{category}}?", { category: label })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "reader.clearCategory.description",
              "This will permanently remove {{count}} saved items from {{category}} in this book. Other reader data and reading progress will stay.",
              { count, category: label },
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" disabled={clear.isPending} onClick={() => setOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
            >
              {t("reader.clearCategory.confirm", "Clear all")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
