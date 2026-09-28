import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import type { AnnotationDto } from "@shared/annotations";
import type { ChapterRefDto } from "@shared/library";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { qk } from "@renderer/query/keys";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { ClearBookCategoryButton } from "./ClearBookCategoryButton";
import {
  ANNOTATION_STYLES,
  countAnnotationsByStyle,
  filterAnnotationsByStyle,
  groupAnnotationsByStyle,
} from "./annotation-colors";
import type { AnnotationStyle } from "@shared/annotations";
import { chapterIdAtPage } from "./pdf-chapter-at-page";
import { parsePdfLocatorRange } from "./pdf-locator";
import { chapterIdAtCfi } from "./chapter-id-at-cfi";
import { useEpubSession } from "./epub-session";
import { annotationColorHex } from "./annotation-colors";

export function AnnotationsList({ bookId }: { bookId: string }) {
  const { t } = useTranslation();
  const [selectedStyle, setSelectedStyle] = useState<AnnotationStyle | null>(null);
  const [groupByStyle, setGroupByStyle] = useState(false);
  const requestScroll = useAnnotationStore((s) => s.requestScroll);
  const { spineHrefs, anchorBoundaries } = useEpubSession();
  const qc = useQueryClient();
  const annos = useQuery({
    queryKey: qk.annotations(bookId),
    queryFn: () => window.api.annotations.listByBook({ bookId }),
  });
  const chapters = useQuery({
    queryKey: qk.chapters(bookId),
    queryFn: () => window.api.content.chapters({ bookId }),
  });
  const deleteM = useMutation({
    mutationFn: window.api.annotations.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotations(bookId) }),
  });

  if (annos.isPending)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {t("reader.annotation.loading", "Đang tải đánh dấu…")}
      </p>
    );
  if (annos.isError)
    return (
      <p className="p-3 text-sm text-destructive">
        {t("reader.annotation.loadError", "Không thể tải đánh dấu")}
      </p>
    );
  const list = annos.data ?? [];

  // Thứ tự từ listByBook ở backend là createdAt giảm dần, chú thích mới nhất đứng trước.
  const chapterTitle = (locator: string): string | null => {
    const pdfRange = parsePdfLocatorRange(locator);
    if (pdfRange) {
      // Với PDF, hiện tên chương và số trang; trước chương đầu thì chỉ hiện số trang.
      const chId = chapterIdAtPage(chapters.data ?? [], pdfRange.page);
      const title = (chapters.data ?? []).find((c: ChapterRefDto) => c.id === chId)?.title;
      return title ? `${title} · p.${pdfRange.page}` : `p.${pdfRange.page}`;
    }
    const chId = chapterIdAtCfi(chapters.data ?? [], spineHrefs, locator, anchorBoundaries);
    return (chapters.data ?? []).find((c: ChapterRefDto) => c.id === chId)?.title ?? null;
  };

  const counts = countAnnotationsByStyle(list);
  const visibleAnnotations = filterAnnotationsByStyle(list, selectedStyle);
  const groups = groupByStyle ? groupAnnotationsByStyle(visibleAnnotations) : [];
  const styleNames: Record<string, string> = {
    yellow: t("reader.annotation.color.yellow"),
    green: t("reader.annotation.color.green"),
    blue: t("reader.annotation.color.blue"),
    pink: t("reader.annotation.color.pink"),
    purple: t("reader.annotation.color.purple"),
    underline: t("reader.annotation.color.underline"),
  };
  const styleName = (style: AnnotationStyle) =>
    styleNames[style] ?? style;
  const listContent = groupByStyle ? (
    <div className="space-y-3">
      {groups.map((group) => (
        <section
          key={group.style}
          aria-label={`${styleName(group.style)} (${group.annotations.length})`}
        >
          <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "size-2.5 rounded-full",
                group.style === "underline" && "border-b-2 border-foreground/60",
              )}
              style={group.style === "underline" ? undefined : { backgroundColor: annotationColorHex(group.style) }}
            />
            {styleName(group.style)} <span>({group.annotations.length})</span>
          </h3>
          <div className="space-y-1.5">
            {group.annotations.map((a) => (
              <AnnoItem
                key={a.id}
                a={a}
                chapter={chapterTitle(a.locatorRange)}
                onGoto={() => requestScroll(a.locatorRange, false, bookId)}
                onDelete={() => deleteM.mutate({ id: a.id })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <div className="space-y-1.5">
      {visibleAnnotations.map((a) => (
        <AnnoItem
          key={a.id}
          a={a}
          chapter={chapterTitle(a.locatorRange)}
          onGoto={() => requestScroll(a.locatorRange, false, bookId)}
          onDelete={() => deleteM.mutate({ id: a.id })}
        />
      ))}
    </div>
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        <div className="flex items-center justify-end">
          <ClearBookCategoryButton bookId={bookId} category="annotations" count={list.length} />
        </div>
        {list.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            {t("reader.annotation.empty", "Chưa có đánh dấu. Hãy thử chọn một đoạn văn.")}
          </p>
        ) : (
          <>
        <div className="rounded-lg border border-border/70 bg-background/60 p-2">
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label={t("reader.annotation.filterByColor")}
          >
            <button
              type="button"
              aria-pressed={selectedStyle === null}
              onClick={() => setSelectedStyle(null)}
              className="rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              {t("reader.annotation.all")} <span>({list.length})</span>
            </button>
            {ANNOTATION_STYLES.filter((style) => counts[style] > 0).map((style) => (
              <button
                key={style}
                type="button"
                aria-pressed={selectedStyle === style}
                aria-label={`${styleNames[style]} (${counts[style]})`}
                onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
              >
                <span
                  aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  style === "underline" && "border-b-2 border-foreground/60",
                )}
                style={style === "underline" ? undefined : { backgroundColor: annotationColorHex(style) }}
                />
                {styleNames[style]} <span>({counts[style]})</span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-end border-t border-border/50 pt-1.5">
            <button
              type="button"
              aria-pressed={groupByStyle}
              onClick={() => setGroupByStyle(!groupByStyle)}
              className="rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              {t("reader.annotation.groupByColor")}
            </button>
          </div>
        </div>
        {visibleAnnotations.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            {t("reader.annotation.filterEmpty")}
          </p>
        ) : (
          listContent
        )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function AnnoItem({
  a,
  chapter,
  onGoto,
  onDelete,
}: {
  a: AnnotationDto;
  chapter: string | null;
  onGoto: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="group flex gap-2 rounded-lg border border-border bg-background/60 p-2">
      <span
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: annotationColorHex(a.style) }}
      />
      <button type="button" onClick={onGoto} className="min-w-0 flex-1 text-start">
        <div className="line-clamp-2 text-xs leading-relaxed text-foreground">{a.selectedText}</div>
        {a.note && (
          <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">✎ {a.note}</div>
        )}
        {chapter && <div className="mt-1 text-[10px] text-muted-foreground/70">{chapter}</div>}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("reader.annotation.delete", "Xóa")}
        onClick={onDelete}
        className="shrink-0 self-start text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
