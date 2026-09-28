import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createLogger } from "@renderer/logger";
import { useQuery } from "@tanstack/react-query";
import {
  VirtualDocs,
  type VirtualDocsHandle,
  type SectionSelectEvent,
} from "@marginalia/virtual-docs";
import type { ChapterRefDto } from "@shared/library";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useNoteHoverStore } from "@renderer/store/note-hover-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { qk } from "../query/keys";
import { chapterIdByHref } from "./chapter-id-by-href";
import { pickAnchorChapterId } from "./current-anchor-chapter";
import { useEpubSession } from "./epub-session";
import { BookFileMissingPanel } from "./BookFileMissingPanel";
import { epubPercent } from "./percent";
import { prefsToCss } from "./prefs-to-css";
import { readerThemeCssForMode } from "./reader-theme-css";
import { sectionSelectToSelectionInfo } from "./epub-selection";
import { applyAnnotations } from "./apply-annotations";
import { ANNO_IFRAME_CSS } from "./highlight";
import { fontFaceCss } from "./reader-fonts";
import { useThemeStore } from "../store/theme-store";
import { ttsController } from "./tts/tts-controller";
import { TTS_IFRAME_CSS } from "./tts/tts-css";
import { readableTextOffsetAtRange, readableTextRangeAtY } from "./epub-text-position";
import { useReadingPosition } from "./use-reading-position";
import type { ReadingPosition } from "./reading-position-machine";
import { useRecordReadingPage } from "./use-record-reading-page";

const log = createLogger("epub");

interface Props {
  bookId: string;
  chapters: ChapterRefDto[];
  persistProgress: boolean;
}

const CURRENT_EPUB_READ_CHARS = 4_000;
const EPUB_CHARS_PER_ESTIMATED_PAGE = 2_500;

export function EpubReader({ bookId, chapters, persistProgress }: Props) {
  const { t } = useTranslation();
  const vRef = useRef<VirtualDocsHandle | null>(null);
  const { book, parseError, bytesError, bytesMissing } = useEpubSession();
  const recordPageRead = useRecordReadingPage(bookId);

  const systemTheme = useThemeStore((s) => s.systemTheme);
  const currentChapterId = useNavigationStore((s) => s.currentChapterId);
  const setCurrentChapter = useNavigationStore((s) => s.setCurrentChapter);
  const setReadingContext = useNavigationStore((s) => s.setReadingContext);
  const setReadingPercent = useNavigationStore((s) => s.setReadingPercent);
  const prefs = usePrefsStore((s) => s.prefs);
  const epubColorMode = usePrefsStore((s) => s.epubColorMode);
  const setSelection = useAnnotationStore((s) => s.setSelection);
  const openStyleBar = useAnnotationStore((s) => s.openStyleBar);
  const closeStyleBar = useAnnotationStore((s) => s.closeStyleBar);
  const scrollCommand = useAnnotationStore((s) => s.scrollCommand);
  const hoverHighlight = useNoteHoverStore((s) => s.hoverHighlight);
  const leaveHighlight = useNoteHoverStore((s) => s.leaveHighlight);
  const closeNoteHover = useNoteHoverStore((s) => s.closeNow);

  // Ghi chương đầu khung nhìn suy ra từ lần cuộn gần nhất để effect chuyển chương không tạo vòng lặp.
  const topChapterIdRef = useRef<string | null>(null);
  // Chỉ số section đầu khung nhìn từ lần cuộn gần nhất, dùng làm điểm bắt đầu TTS.
  const topSectionIndexRef = useRef(0);
  // Chỉ cảnh báo một lần khi không đổi được Range thành tọa độ văn bản, tránh ghi log dồn dập khi cuộn.
  const offsetFallbackWarnedRef = useRef(false);

  // Khi mở sách, đổi locator tiến độ dạng CFI thành chỉ số spine một lần.
  const progress = useQuery({
    queryKey: qk.progress(bookId),
    queryFn: () => window.api.progress.get({ bookId }),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!progress.isPending) setReadingPercent(progress.data?.percent ?? 0);
  }, [progress.data?.percent, progress.isPending, setReadingPercent]);

  const annotations = useQuery({
    queryKey: qk.annotations(bookId),
    queryFn: () => window.api.annotations.listByBook({ bookId }),
    staleTime: Infinity,
  });

  // EpubSessionProvider quản lý vòng đời sách; reader tự đặt lại state của mình khi đổi sách tại đây.
  useEffect(() => {
    topChapterIdRef.current = null;
    topSectionIndexRef.current = 0;
    offsetFallbackWarnedRef.current = false;
  }, [bookId]);

  // Point CFI từ cfiFromElement kết thúc bằng đoạn xác nhận [id], nhưng epubjs toRange thường trả null.
  // Lấy [id] cuối làm id phần tử neo để dự phòng.
  const resolveCfiElement = (cfi: string) => (doc: Document) => {
    if (!book) return null;
    const idAssertion = [...cfi.matchAll(/\[([^\]]+)\]/g)].at(-1)?.[1] ?? null;
    // Thử rangeFromCfi trước để định vị chính xác chú thích; nếu thất bại, tìm phần tử bằng [id] để khôi phục tiến độ.
    const node = book.rangeFromCfi(cfi, doc)?.startContainer ?? null;
    const fromRange = node ? (node.nodeType === 1 ? (node as Element) : node.parentElement) : null;
    return fromRange ?? (idAssertion ? doc.getElementById(idAssertion) : null);
  };

  const resolveChapterTarget = (chapterId: string) => {
    const ch = chapters.find((c) => c.id === chapterId);
    if (!ch || !book) return null;
    const index = book.indexOfHref(ch.href);
    return index < 0 ? null : { index, anchor: ch.anchor ?? null };
  };

  const reportPosition = (position: ReadingPosition) => {
    if (position.chapterId == null) return;
    if (book) {
      const totalChars = book.textLengths.reduce((sum, length) => sum + length, 0);
      const estimatedPages = Math.max(
        book.count,
        Math.ceil(totalChars / EPUB_CHARS_PER_ESTIMATED_PAGE),
        1,
      );
      recordPageRead(
        Math.min(estimatedPages, Math.floor(position.percent * estimatedPages) + 1),
        estimatedPages,
      );
    }
    setReadingContext({
      format: "epub",
      chapterId: position.chapterId,
      chapterTitle: position.chapterTitle,
      offset: position.offset,
      maxChars: CURRENT_EPUB_READ_CHARS,
      spineIndex: position.index,
      locator: position.cfi,
    });
    topChapterIdRef.current = position.chapterId;
    if (position.chapterId !== currentChapterId) setCurrentChapter(position.chapterId);
  };

  const { raise } = useReadingPosition({
    bookId,
    book,
    persistProgress,
    vRef,
    resolveCfiElement,
    resolveChapterTarget,
    reportPosition,
  });

  // Khi chọn chương trong ChapterList, cuộn đến chỉ số spine tương ứng theo điểm neo.
  useEffect(() => {
    if (currentChapterId == null) return;
    if (currentChapterId === topChapterIdRef.current) return; // Thay đổi do cuộn, không cuộn ngược lại.
    raise({ type: "CHAPTER_REQUESTED", chapterId: currentChapterId });
  }, [currentChapterId, raise]);

  // Đổi locator tiến độ thành section index để VirtualDocs mở đúng section ngay lần đầu.
  // Sau đó state machine định vị chính xác theo điểm neo vì initialIndex chỉ tới đầu section.
  const initialIndex =
    book && progress.data?.locator != null
      ? (() => {
          const i = book.indexOfCfi(progress.data.locator);
          return i >= 0 ? i : 0;
        })()
      : 0;

  useEffect(() => {
    if (!book || progress.isLoading) return;
    const locator = progress.data?.locator ?? null;
    const target = locator == null ? -1 : book.indexOfCfi(locator);
    raise({ type: "SESSION_READY", locator, targetIndex: target >= 0 ? target : null });
  }, [book, progress.isLoading, progress.data?.locator, raise]);

  // Gắn ngữ cảnh TTS khi sách sẵn sàng; tháo khi đóng hoặc đổi sách để dừng đọc và xóa tô sáng.
  useEffect(() => {
    if (!book) return;
    ttsController.attach({
      sectionCount: book.count,
      getTopSectionIndex: () => topSectionIndexRef.current,
      scrollToSection: (i) => vRef.current?.scrollToIndex(i),
      getScroller: () => vRef.current?.getScrollerElement() ?? null,
    });
    return () => ttsController.detach();
  }, [book]);

  const onSelect = (e: SectionSelectEvent) => {
    const cfiRange = book ? book.cfiFromRange(e.index, e.range) : null;
    setSelection(sectionSelectToSelectionInfo(e, cfiRange));
  };
  const onSelectionCleared = () => setSelection(null);

  const chapterTextOffsetBeforeIndex = (chapterId: string, index: number): number => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const href = book?.hrefAtIndex(i);
      if (href && chapterIdByHref(chapters, href) === chapterId)
        offset += book?.chapterTextLengthAtIndex(i) ?? 0;
    }
    return offset;
  };

  const stripFrag = (h: string) => h.split("#")[0]!;
  // section.href của epubjs không có tiền tố thư mục OPF, còn chapter.href trong DB thì có.
  // Ghép theo tên tệp cuối để xác định section, như chapter-id-by-href.
  const basenameOf = (h: string) => {
    const p = stripFrag(h);
    return p.slice(p.lastIndexOf("/") + 1);
  };

  const onTopSectionChange = (index: number, meta: { scrollRatio: number }) => {
    if (!book) return;
    topSectionIndexRef.current = index;
    // Tô sáng chương hiện tại theo điểm neo.
    const anchorChapterIdAt = (sectionIndex: number): string | null => {
      const sHref = book.hrefAtIndex(sectionIndex);
      if (!sHref) return null;
      const sBase = basenameOf(sHref);
      const sectionChs = chapters
        .filter((c) => basenameOf(c.href) === sBase)
        .filter((c) => c.anchor);
      if (sectionChs.length === 0) return chapterIdByHref(chapters, sHref); // Chương không có neo thì tìm theo href.
      const frame = document.querySelector<HTMLIFrameElement>(
        `[data-section-index="${sectionIndex}"] iframe`,
      );
      const doc = frame?.contentDocument;
      const docRoot = doc?.documentElement;
      if (!doc || !docRoot) return chapterIdByHref(chapters, sHref);
      const docTop = docRoot.getBoundingClientRect().top;
      const positions = sectionChs
        .map((c) => {
          const el = c.anchor ? doc.getElementById(c.anchor) : null;
          return el
            ? { id: c.id, anchor: c.anchor!, top: el.getBoundingClientRect().top - docTop }
            : null;
        })
        .filter((x): x is { id: string; anchor: string; top: number } => x !== null)
        .sort((a, b) => a.top - b.top);
      const sectionHeight = book.textLengthAtIndex(sectionIndex) ? docRoot.scrollHeight : 0;
      const viewportTop = sectionHeight * meta.scrollRatio;
      return pickAnchorChapterId(positions, viewportTop) ?? chapterIdByHref(chapters, sHref);
    };

    const chId = anchorChapterIdAt(index);
    const ch = chId ? chapters.find((c) => c.id === chId) : null;

    // Lưu tiến độ tới phần tử khối ở đầu khung nhìn bằng range CFI của ký tự đầu tiên.
    // rangeFromCfi khôi phục chính xác range CFI, còn point CFI của cfiFromElement thường không đổi được bằng toRange.
    // Nếu cần thì lùi về CFI đầu section.
    const topReadablePosition = (
      sectionIndex: number,
    ): { cfi: string; textOffset: number | null } => {
      const fallback = book!.cfiAtIndex(sectionIndex) ?? "";
      const frame = document.querySelector<HTMLIFrameElement>(
        `[data-section-index="${sectionIndex}"] iframe`,
      );
      const doc = frame?.contentDocument;
      const scroller = vRef.current?.getScrollerElement() ?? null;
      if (!doc?.documentElement || !frame || !scroller) return { cfi: fallback, textOffset: null };
      // Vị trí đầu khung nhìn trong section bằng đỉnh scroller trừ đỉnh iframe theo tọa độ chính.
      // Iframe không tự cuộn nên có thể so trực tiếp với getBoundingClientRect().top của phần tử khối.
      const targetInDoc = scroller.getBoundingClientRect().top - frame.getBoundingClientRect().top;
      const range = readableTextRangeAtY(doc, targetInDoc);
      if (!range) return { cfi: fallback, textOffset: null };
      return {
        cfi: book!.cfiFromRange(sectionIndex, range) ?? fallback,
        textOffset: readableTextOffsetAtRange(doc, range),
      };
    };

    const { cfi, textOffset } = topReadablePosition(index);
    if (
      textOffset == null &&
      book.textLengthAtIndex(index) > 0 &&
      !offsetFallbackWarnedRef.current
    ) {
      offsetFallbackWarnedRef.current = true;
      log.warn(`text offset unavailable; using section scroll ratio: ${index}`);
    }
    const percent = epubPercent(index, textOffset, book.textLengths, meta.scrollRatio);
    // Chương theo neo chỉ là một đoạn trong tệp spine lớn. readChapterText đọc trọn chương nên offset bắt đầu từ 0.
    // Offset tính theo cả section có thể vượt độ dài chương và làm công cụ AI đọc vị trí hiện tại nhận chuỗi rỗng.
    // Chương không có neo và chiếm cả tệp vẫn dùng offset theo section.
    const sectionLength = book.chapterTextLengthAtIndex(index);
    const offset =
      chId == null
        ? 0
        : ch?.anchor
          ? 0
          : chapterTextOffsetBeforeIndex(chId, index) +
            Math.floor(sectionLength * meta.scrollRatio);
    raise({
      type: "TOP_SECTION_CHANGED",
      position: {
        index,
        scrollRatio: meta.scrollRatio,
        cfi,
        percent,
        chapterId: chId,
        chapterTitle: ch?.title ?? null,
        offset,
      },
    });
  };

  const decorate = (index: number, doc: Document) => {
    if (book) applyAnnotations(book, annotations.data ?? [], index, doc);
  };
  const onHighlightClick = (
    annoId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    openStyleBar({ rect, target: { type: "edit", annotationId: annoId } });
  };
  // Mousedown trong nội dung đóng thanh kiểu và xóa vùng chọn cùng frame để thanh chính không lóe trở lại.
  // Khi nhấn vùng tô sáng, mousedown đóng thanh cũ rồi click mở thanh chỉnh sửa của vùng đó.
  const onContentMouseDown = () => {
    closeStyleBar();
    setSelection(null);
  };

  // Khi dữ liệu chú thích đổi, tô lại các section đang gắn.
  useEffect(() => {
    vRef.current?.redecorate();
  }, [annotations.data]);

  const onInternalLink = ({ index, href }: { index: number; href: string }) => {
    if (!book) return;
    const hash = href.indexOf("#");
    const anchor = hash >= 0 ? href.slice(hash + 1) : "";
    // Fragment không có đường dẫn thuộc section hiện tại; nếu có đường dẫn thì tìm section đích.
    const targetIdx = href.startsWith("#") ? index : book.indexOfHref(href);
    if (targetIdx < 0) {
      log.warn(`internal link target not found: ${href}`);
      return;
    }
    if (anchor) void vRef.current?.scrollToAnchor(targetIdx, anchor);
    else vRef.current?.scrollToIndex(targetIdx);
  };
  const onExternalLink = (url: string) => {
    void window.api.app
      .openExternal({ url })
      .catch((err: unknown) => log.warn("open external failed", err));
  };

  // Nhấn chú thích ở thanh bên sẽ cuộn chính xác đến phần tử neo qua CFI.
  useEffect(() => {
    if (!scrollCommand) return;
    raise({ type: "ANNOTATION_SCROLL", locator: scrollCommand.locator });
  }, [scrollCommand, raise]);

  // Cuộn sẽ đóng thanh kiểu và xóa vùng chọn vì tọa độ neo trong khung nhìn không còn đúng.
  // Lắng nghe ở pha capture trên document để bắt cuộn của Virtuoso dù sự kiện scroll không nổi bọt.
  useEffect(() => {
    const onScroll = () => {
      closeStyleBar();
      setSelection(null);
      closeNoteHover();
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [closeStyleBar, setSelection, closeNoteHover]);

  if (bytesMissing) return <BookFileMissingPanel bookId={bookId} />;
  if (bytesError)
    return <ReaderError message={t("reader.epub.loadError", "Không thể đọc tệp sách này.")} />;
  if (parseError)
    return (
      <ReaderError
        message={t("reader.epub.parseError", "Không thể hiển thị sách này: {{error}}", { error: parseError })}
      />
    );
  // Chờ byte sách và tiến độ sẵn sàng rồi mới gắn VirtualDocs để initialIndex đúng ngay lần đầu.
  if (!book || progress.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {t("reader.epub.loading", "Đang tải…")}
      </div>
    );
  }

  return (
    <div className="h-full">
      <VirtualDocs
        ref={vRef}
        className="reader-scroll-region"
        count={book.count}
        loadSection={book.loadSection}
        sectionWeight={book.textLengthAtIndex}
        initialPxPerWeight={0.1}
        styleCss={
          fontFaceCss(prefs.fontFamily) +
          "\n" +
          prefsToCss(prefs) +
          "\n" +
          ANNO_IFRAME_CSS +
          "\n" +
          readerThemeCssForMode(epubColorMode, systemTheme) +
          "\n" +
          TTS_IFRAME_CSS
        }
        initialIndex={initialIndex}
        onTopSectionChange={onTopSectionChange}
        onUnloadSection={(i) => book.unloadSection(i)}
        onSelect={onSelect}
        onSelectionCleared={onSelectionCleared}
        decorate={decorate}
        onHighlightClick={onHighlightClick}
        onHighlightHover={hoverHighlight}
        onHighlightLeave={leaveHighlight}
        onContentMouseDown={onContentMouseDown}
        onUserNavigation={() => raise({ type: "USER_NAVIGATED" })}
        onTransition={(r) => log.debug("viewport transition", r)}
        onInternalLink={onInternalLink}
        onExternalLink={onExternalLink}
      />
    </div>
  );
}

function ReaderError({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
