import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn } from "@renderer/lib/utils";
import type { PdfBook } from "./pdf-book";
import { pdfCanvasFilter } from "./pdf-page-appearance";

const THUMB_WIDTH = 132;

export interface PdfNavigationState {
  bookId: string;
  book: PdfBook;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  invert: boolean;
  brightness: number;
  onJump: (page: number) => void;
}

function Thumbnail({
  book,
  index,
  currentPage,
  rotation,
  invert,
  brightness,
  onJump,
}: {
  book: PdfBook;
  index: number;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  invert: boolean;
  brightness: number;
  onJump: (page: number) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const aspect =
    rotation === 90 || rotation === 270
      ? book.baseSize.width / book.baseSize.height
      : book.baseSize.height / book.baseSize.width;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let mounted = true;
    setFailed(false);
    const task = book.renderPage(
      index,
      canvas,
      THUMB_WIDTH,
      undefined,
      undefined,
      undefined,
      rotation,
    );
    void task.done.catch(() => {
      if (mounted) setFailed(true);
    });
    return () => {
      mounted = false;
      task.cancel();
    };
  }, [book, index, rotation]);

  const page = index + 1;
  return (
    <button
      type="button"
      className={cn(
        "mx-auto my-2 flex w-40 flex-col items-center gap-1 rounded-md border p-2 text-xs hover:bg-accent",
        page === currentPage ? "border-primary bg-primary/10" : "border-transparent",
      )}
      aria-current={page === currentPage ? "page" : undefined}
      aria-label={t("reader.pdf.thumbnails.page", { page })}
      onClick={() => onJump(page)}
    >
      {failed ? (
        <span
          className="flex items-center justify-center bg-muted text-muted-foreground"
          style={{ width: THUMB_WIDTH, height: THUMB_WIDTH * aspect }}
        >
          {t("reader.pdf.pageRenderError", { page })}
        </span>
      ) : (
        <canvas
          ref={canvasRef}
          className="bg-white shadow-sm"
          style={{
            width: THUMB_WIDTH,
            height: THUMB_WIDTH * aspect,
            filter: pdfCanvasFilter(invert, brightness),
          }}
        />
      )}
      <span>{page}</span>
    </button>
  );
}

export function PdfThumbnailsPanel({
  book,
  currentPage,
  rotation,
  invert,
  brightness,
  onJump,
}: {
  book: PdfBook;
  currentPage: number;
  rotation: 0 | 90 | 180 | 270;
  invert: boolean;
  brightness: number;
  onJump: (page: number) => void;
}) {
  const { t } = useTranslation();
  const listRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    listRef.current?.scrollToIndex({ index: Math.max(0, currentPage - 1), align: "center" });
  }, [currentPage]);

  return (
    <aside className="h-full min-h-0" aria-label={t("reader.pdf.thumbnails.title")}>
      <Virtuoso
        ref={listRef}
        className="min-h-0 flex-1"
        style={{ height: "100%" }}
        totalCount={book.pageCount}
        initialTopMostItemIndex={Math.max(0, currentPage - 1)}
        itemContent={(index) => (
          <Thumbnail
            book={book}
            index={index}
            currentPage={currentPage}
            rotation={rotation}
            invert={invert}
            brightness={brightness}
            onJump={onJump}
          />
        )}
      />
    </aside>
  );
}
