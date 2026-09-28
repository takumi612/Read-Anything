import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { usePdfTabsStore, type PdfTab } from "@renderer/store/pdf-tabs-store";

export function PdfTabsBar({ currentBookId }: { currentBookId: string }) {
  const { t } = useTranslation();
  const tabs = usePdfTabsStore((state) => state.tabs);
  const books = useQuery({ queryKey: qk.library, queryFn: () => window.api.library.list() });
  const titles = new Map(books.data?.map((book) => [book.id, book.title ?? book.id]) ?? []);

  const activate = (tab: PdfTab) => {
    if (tab.bookId === currentBookId) return;
    usePdfTabsStore.getState().activate(tab.bookId);
    const navigation = useNavigationStore.getState();
    const finished =
      books.data?.find((book) => book.id === tab.bookId)?.readingState === "finished";
    if (tab.mode === "active" && !finished) navigation.openBook(tab.bookId);
    else navigation.openBookReference(tab.bookId);
  };

  const close = (bookId: string) => {
    const index = tabs.findIndex((tab) => tab.bookId === bookId);
    const next = tabs[index + 1] ?? tabs[index - 1];
    usePdfTabsStore.getState().close(bookId);
    if (bookId !== currentBookId) return;
    if (next) activate(next);
    else useNavigationStore.getState().backToLibrary();
  };

  return (
    <nav
      className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/20 px-2"
      aria-label={t("reader.pdf.tabs.title")}
    >
      {tabs.map((tab) => {
        const title = titles.get(tab.bookId) ?? tab.bookId;
        const active = tab.bookId === currentBookId;
        return (
          <div
            key={tab.bookId}
            className={`flex max-w-52 min-w-28 shrink-0 items-center rounded-t-md border border-b-0 px-1 ${active ? "border-border bg-background" : "border-transparent bg-muted/60"}`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate px-2 py-1 text-left text-xs"
              title={title}
              aria-current={active ? "page" : undefined}
              onClick={() => activate(tab)}
            >
              {title}
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label={t("reader.pdf.tabs.close", { title })}
              onClick={() => close(tab.bookId)}
            >
              <X />
            </Button>
          </div>
        );
      })}
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        aria-label={t("reader.pdf.tabs.openAnother")}
        title={t("reader.pdf.tabs.openAnother")}
        onClick={() => useNavigationStore.getState().backToLibrary()}
      >
        <Plus />
      </Button>
    </nav>
  );
}
