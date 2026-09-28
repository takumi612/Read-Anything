import { useTranslation } from "react-i18next";
import { List, PanelLeftClose, PanelsTopLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@renderer/components/ui/tabs";
import { Button } from "@renderer/components/ui/button";
import { ChapterList } from "./ChapterList";
import { PdfThumbnailsPanel, type PdfNavigationState } from "./PdfThumbnailsPanel";

export type PdfTocView = "contents" | "pages";

export function Sidebar({
  bookId,
  format,
  pdfNavigation,
  pdfTocView,
  onPdfTocViewChange,
  onCollapseSidebar,
}: {
  bookId: string;
  format?: "pdf" | "epub";
  pdfNavigation: PdfNavigationState | null;
  pdfTocView: PdfTocView;
  onPdfTocViewChange: (view: PdfTocView) => void;
  onCollapseSidebar: () => void;
}) {
  const { t } = useTranslation();
  const collapseSidebarLabel = t("reader.collapseSidebar", "Collapse sidebar");
  const collapseButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onCollapseSidebar}
      aria-label={collapseSidebarLabel}
      aria-expanded={true}
      title={collapseSidebarLabel}
      className="size-8 shrink-0"
    >
      <PanelLeftClose />
    </Button>
  );
  // Keep navigation limited to the document outline and PDF pages.
  return (
    <div className="flex h-full flex-col bg-muted/30">
      {format === "pdf" ? (
        <Tabs
          value={pdfTocView}
          onValueChange={(value) => {
            if (value) onPdfTocViewChange(value as PdfTocView);
          }}
          className="min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-border p-1.5">
            <TabsList className="h-8 min-w-0 flex-1">
              <TabsTrigger value="contents" aria-label={t("reader.toc", "Contents")}>
                <List />
                {t("reader.toc", "Contents")}
              </TabsTrigger>
              <TabsTrigger value="pages" aria-label={t("reader.pdf.pages", "Pages")}>
                <PanelsTopLeft />
                {t("reader.pdf.pages", "Pages")}
              </TabsTrigger>
            </TabsList>
            {collapseButton}
          </div>
          <TabsContent value="contents" className="min-h-0 overflow-hidden">
            <ChapterList bookId={bookId} />
          </TabsContent>
          <TabsContent value="pages" className="min-h-0 overflow-hidden">
            {pdfNavigation?.bookId === bookId ? (
              <PdfThumbnailsPanel
                book={pdfNavigation.book}
                currentPage={pdfNavigation.currentPage}
                rotation={pdfNavigation.rotation}
                invert={pdfNavigation.invert}
                brightness={pdfNavigation.brightness}
                onJump={pdfNavigation.onJump}
              />
            ) : (
              <p className="p-3 text-xs text-muted-foreground">
                {t("reader.pdf.thumbnails.loading", "Loading PDF pages…")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="min-h-0 flex-1">
          <div className="flex h-10 items-center justify-between border-b border-border px-2">
            <span className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
              <List className="size-4" />
              {t("reader.toc", "Contents")}
            </span>
            {collapseButton}
          </div>
          <ChapterList bookId={bookId} />
        </div>
      )}
    </div>
  );
}
