import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@renderer/components/ui/button";
import { Textarea } from "@renderer/components/ui/textarea";
import { qk } from "@renderer/query/keys";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { makePdfLocator } from "./pdf-locator";
import { ClearBookCategoryButton } from "./ClearBookCategoryButton";

export function PdfBookmarksList({ bookId }: { bookId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const requestScroll = useAnnotationStore((state) => state.requestScroll);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bookmarks = useQuery({
    queryKey: qk.pdfBookmarks(bookId),
    queryFn: () => window.api.library.bookmarks.list({ bookId }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: qk.pdfBookmarks(bookId) });
  const rename = useMutation({ mutationFn: window.api.library.bookmarks.rename, onSuccess: refresh });
  const remove = useMutation({ mutationFn: window.api.library.bookmarks.delete, onSuccess: refresh });

  if (bookmarks.isPending) {
    return <p className="p-3 text-sm text-muted-foreground">{t("reader.pdf.bookmarks.loading")}</p>;
  }
  if (bookmarks.isError) {
    return <p className="p-3 text-sm text-destructive">{t("reader.pdf.bookmarks.error")}</p>;
  }
  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="flex items-center justify-end pb-2">
        <ClearBookCategoryButton
          bookId={bookId}
          category="bookmarks"
          count={bookmarks.data.length}
        />
      </div>
      {bookmarks.data.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{t("reader.pdf.bookmarks.empty")}</p>
      ) : (
      <ul className="space-y-1">
        {bookmarks.data.map((bookmark) => (
          <li key={bookmark.id} className="flex items-center gap-1 rounded-lg border border-border/70 p-2">
            {editingId === bookmark.id ? (
              <Textarea
                autoFocus
                value={draft}
                maxLength={500}
                rows={3}
                className="min-h-20 flex-1 resize-y text-sm"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditingId(null);
                }}
                aria-label={t("reader.pdf.bookmarks.rename")}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 text-left text-sm"
                onClick={() =>
                  requestScroll(
                    makePdfLocator({ page: bookmark.page, scrollRatio: bookmark.scrollRatio }),
                    false,
                    bookId,
                  )
                }
              >
                <span className="line-clamp-3 break-words">{bookmark.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t("reader.pdf.bookmarks.page", { page: bookmark.page })}
                </span>
              </button>
            )}
            {editingId === bookmark.id ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={!draft.trim() || rename.isPending}
                  aria-label={t("reader.pdf.bookmarks.save")}
                  onClick={() =>
                    rename.mutate({ id: bookmark.id, title: draft.trim() }, {
                      onSuccess: () => setEditingId(null),
                      onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
                    })
                  }
                >
                  <Check />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={t("common.cancel")} onClick={() => setEditingId(null)}>
                  <X />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("reader.pdf.bookmarks.rename")}
                  onClick={() => {
                    setEditingId(bookmark.id);
                    setDraft(bookmark.title);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("reader.pdf.bookmarks.delete")}
                  onClick={() =>
                    remove.mutate({ id: bookmark.id }, {
                      onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
