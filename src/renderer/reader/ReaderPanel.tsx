import {
  Bookmark,
  Highlighter,
  Languages,
  NotebookPen,
  X,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import { AnnotationsList } from "@renderer/reader/AnnotationsList";
import { BookNotesPanel } from "@renderer/book-notes/BookNotesPanel";
import { PdfBookmarksList } from "@renderer/reader/PdfBookmarksList";
import { VocabularyList } from "@renderer/reader/VocabularyList";
import type { ReaderPanelAccessibilityView } from "@renderer/reader/reader-panel-accessibility";

export type ReaderPanelView = ReaderPanelAccessibilityView;
export type ReaderToolView = Exclude<ReaderPanelView, "assistant">;

export function ReaderToolsMenu({
  format,
  onSelect,
}: {
  format?: "pdf" | "epub";
  onSelect: (view: ReaderToolView) => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("reader.tools", "Reader tools")}
            title={t("reader.tools", "Reader tools")}
            className="text-muted-foreground"
          />
        }
      >
        <Wrench />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t("reader.tools", "Reader tools")}
          </div>
          <DropdownMenuItem onClick={() => onSelect("annotations")}>
            <Highlighter aria-hidden="true" />
            <span>{t("reader.annotations", "Annotations")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect("vocabulary")}>
            <Languages aria-hidden="true" />
            <span>{t("reader.vocabulary", "Vocabulary")}</span>
          </DropdownMenuItem>
          {format === "pdf" && (
            <DropdownMenuItem onClick={() => onSelect("bookmarks")}>
              <Bookmark aria-hidden="true" />
              <span>{t("reader.pdf.bookmarks.title", "Bookmarks")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onSelect("notes")}>
            <NotebookPen aria-hidden="true" />
            <span>{t("reader.bookNotes", "Book notes")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReaderUtilityPanel({
  bookId,
  format,
  view,
  onClose,
}: {
  bookId: string;
  format?: "pdf" | "epub";
  view: ReaderToolView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title =
    view === "annotations"
      ? t("reader.annotations", "Annotations")
      : view === "vocabulary"
        ? t("reader.vocabulary", "Vocabulary")
        : view === "bookmarks"
          ? t("reader.pdf.bookmarks.title", "Bookmarks")
          : t("reader.bookNotes", "Book notes");

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30 font-sans">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t("ai.closePanel", "Close panel")}
          title={t("ai.closePanel", "Close panel")}
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        {view === "annotations" && <AnnotationsList bookId={bookId} />}
        {view === "vocabulary" && <VocabularyList bookId={bookId} isPdf={format === "pdf"} />}
        {view === "bookmarks" &&
          (format === "pdf" ? (
            <PdfBookmarksList bookId={bookId} />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              {t("reader.pdf.bookmarks.title", "Bookmarks")}
            </p>
          ))}
        {view === "notes" && <BookNotesPanel bookId={bookId} />}
      </div>
    </div>
  );
}
