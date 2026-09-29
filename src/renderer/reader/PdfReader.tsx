import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { createLogger } from "@renderer/logger";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { cn } from "@renderer/lib/utils";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useThemeStore } from "@renderer/store/theme-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import type { ChapterRefDto, ProgressDto, SaveProgressInput } from "@shared/library";
import { qk } from "../query/keys";
import { createPdfBook, type PdfBook } from "./pdf-book";
import { BookFileMissingPanel } from "./BookFileMissingPanel";
import { makePdfLocator, parsePdfLocator, parsePdfLocatorRange } from "./pdf-locator";
import { pdfAnnosByPage, rangeFromOffsets, relativeRects } from "./pdf-annotations";
import {
  buildPdfSelectionInfo,
  flatOffsetOf,
  pointInDomSelection,
  shouldDismissPdfSelectionOnScroll,
} from "./pdf-selection";
import { chapterIdAtPage } from "./pdf-chapter-at-page";
import { clampPdfZoom, clampPdfZoomScale, nextZoom, PDF_ZOOM_STEP } from "./pdf-zoom";
import {
  intraPageRatio,
  PAGE_PADDING_Y,
  positionAtViewportTop,
  scrollTopFor,
  topPageAt,
  zoomScrollLeft,
  zoomScrollOffset,
} from "./pdf-scroll";
import { findPdfTextLinks } from "./pdf-autolink";
import { overlayClass } from "./highlight";
import { annotationColorRgba } from "./annotation-colors";
import type { PdfPageAnno } from "./pdf-annotations";
import { hitHighlight, usePdfHighlights } from "./use-pdf-highlights";
import { useNoteHoverStore } from "@renderer/store/note-hover-store";
import {
  hitVocabulary,
  shouldShowVocabularyPreview,
  usePdfVocabulary,
  type VocabularyMark,
} from "./use-pdf-vocabulary";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import { Button } from "@renderer/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Label } from "@renderer/components/ui/label";
import { Textarea } from "@renderer/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  Download,
  Ellipsis,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PdfSearchPanel } from "./PdfSearchPanel";
import {
  DEFAULT_PDF_SEARCH_OPTIONS,
  findPdfTextMatches,
  type PdfSearchOptions,
  type PdfSearchResult,
} from "./pdf-search";
import { usePdfSearchMarks } from "./use-pdf-search-marks";
import type { PdfNavigationState } from "./PdfThumbnailsPanel";
import { useRecordReadingPage } from "./use-record-reading-page";
import {
  pdfBackdropBrightnessOverlay,
  pdfBackdropForSelection,
  pdfCanvasFilter,
  shouldInvertPdfPages,
} from "./pdf-page-appearance";
import { selectedPdfSurroundingColor } from "@renderer/theme/pdf-surrounding-colors";

const log = createLogger("pdf");

interface Props {
  bookId: string;
  chapters: ChapterRefDto[];
  persistProgress: boolean;
  onNavigationChange?: (state: PdfNavigationState | null) => void;
}

const SAVE_DEBOUNCE_MS = 1000; // Đồng bộ với EpubReader.
/** Khoảng trống hai bên danh sách trang, tính bằng px. */
const PAGE_GUTTER = 48;
/** Hai lần cập nhật độ phóng đại cách nhau không quá mức này thuộc cùng một thao tác; giữ nguyên điểm neo. */
const ZOOM_GESTURE_GAP_MS = 250;
const ZOOM_SETTLE_MS = ZOOM_GESTURE_GAP_MS + 50;
/** Chờ hết khoảng này sau khi phóng đại rồi mới vẽ lại trang; CSS kéo giãn ảnh cũ trong lúc chờ. */
const RENDER_DEBOUNCE_MS = 140;
const EMPTY_VOCABULARY: VocabularyEntryDto[] = [];
const EMPTY_PDF_ANNOS: PdfPageAnno[] = [];
const CITATION_SEARCH_OPTIONS: PdfSearchOptions = { caseSensitive: false, wholeWord: false };

function renderedPdfPosition(
  scroller: HTMLElement,
  viewportY = scroller.getBoundingClientRect().top,
) {
  const pages = Array.from(
    scroller.querySelectorAll<HTMLElement>(".textLayer[data-page]"),
    (layer) => {
      const rect = layer.getBoundingClientRect();
      return { page: Number(layer.dataset.page), top: rect.top, height: rect.height };
    },
  );
  return positionAtViewportTop(viewportY, pages);
}

export function PdfReader({ bookId, chapters, persistProgress, onNavigationChange }: Props) {
  const { t } = useTranslation();
  const systemTheme = useThemeStore((s) => s.systemTheme);
  const pdfColorMode = usePrefsStore((s) => s.pdfColorMode);
  const pdfSurroundingBackground = usePrefsStore((s) => s.pdfSurroundingBackground);
  const pdfBrightness = usePrefsStore((s) => s.pdfBrightness);
  const pdfSurroundingBrightness = usePrefsStore((s) => s.pdfSurroundingBrightness);
  const customSurroundingColor = selectedPdfSurroundingColor(pdfSurroundingBackground);
  const invertPdfPages = customSurroundingColor
    ? false
    : shouldInvertPdfPages(pdfColorMode, systemTheme);
  const pdfBackdrop = pdfBackdropForSelection(
    customSurroundingColor?.color ?? null,
    pdfColorMode,
    systemTheme,
  );
  const pdfBackdropOverlay = pdfBackdropBrightnessOverlay(pdfSurroundingBrightness);
  const qc = useQueryClient();
  const [book, setBook] = useState<PdfBook | null>(null);
  const [liveZoom, setLiveZoom] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOptions, setSearchOptions] = useState<PdfSearchOptions>(DEFAULT_PDF_SEARCH_OPTIONS);
  const [activeSearch, setActiveSearch] = useState<{ page: number; ordinal: number } | null>(null);
  const [citationFlash, setCitationFlash] = useState<{
    page: number;
    quote: string | null;
    nonce: number;
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bookmarkPosition, setBookmarkPosition] = useState<{
    page: number;
    scrollRatio: number;
  } | null>(null);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [viewMode, setViewMode] = useState<"continuous" | "single">("continuous");
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const consumedScrollCommand = useRef<string | null>(null);
  // PdfPrefs trên thanh đầu điều chỉnh và lưu độ phóng đại; ở đây chỉ đọc, đồng thời chặn giá trị cũ vượt giới hạn.
  const manualZoom = clampPdfZoomScale(usePrefsStore((s) => s.pdfZoom));
  const fitMode = useNavigationStore((s) => s.pdfFitModeByBook[bookId] ?? "custom");
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingProgress = useRef<SaveProgressInput | null>(null);
  const appliedBookZoom = useRef<string | null>(null);
  // Virtuoso gọi rangeChanged khi vừa gắn, kể cả lúc khôi phục vị trí; bỏ lần đầu vì người dùng chưa cuộn.
  // Nếu initialScrollTop khác 0, Virtuoso vẽ ở vị trí 0 rồi cuộn trong rAF nên gọi hai lần.
  // Lần thứ hai có thể ghi lại locator vừa tải với cùng giá trị; thao tác này an toàn.
  const sawInitialRange = useRef(false);
  const currentChapterId = useNavigationStore((s) => s.currentChapterId);
  const setCurrentChapter = useNavigationStore((s) => s.setCurrentChapter);
  const setReadingContext = useNavigationStore((s) => s.setReadingContext);
  const setReadingPercent = useNavigationStore((s) => s.setReadingPercent);
  const currentPage = useNavigationStore((s) =>
    s.readingContext?.format === "pdf" ? (s.readingContext.page ?? 1) : 1,
  );
  const recordPageRead = useRecordReadingPage(bookId);
  const backCount = useNavigationStore((s) => s.pdfHistoryByBook[bookId]?.back.length ?? 0);
  const forwardCount = useNavigationStore((s) => s.pdfHistoryByBook[bookId]?.forward.length ?? 0);
  const vocabularyVisible = useNavigationStore((s) => s.pdfVocabularyVisibleByBook[bookId] ?? true);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  // Vùng cuộn Virtuoso; ưu tiên hình học của textLayer đã bố trí để xác định trang hiện tại.
  const scrollerRef = useRef<HTMLElement | null>(null);
  const revealSearchMatch = useCallback((rect: DOMRect) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const viewport = scroller.getBoundingClientRect();
    const target = scroller.scrollTop + rect.top - viewport.top - Math.max(72, viewport.height / 4);
    scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, []);
  // Ghi lại chương suy ra từ lần cuộn gần nhất để effect chuyển chương không tạo vòng lặp, tương tự EpubReader.
  const topChapterIdRef = useRef<string | null>(null);

  // Kích thước CSS của trang bằng độ rộng vừa khung nhân mức phóng đại; hook phóng đại cần nó trước nhánh return sớm.
  // Khi sách chưa sẵn sàng, pageH bằng 0 để các effect liên quan bỏ qua.
  const aspect = book
    ? rotation === 90 || rotation === 270
      ? book.baseSize.width / book.baseSize.height
      : book.baseSize.height / book.baseSize.width
    : 0;
  const fitPageZoom =
    aspect > 0 && containerW > PAGE_GUTTER && containerH > 32
      ? Math.max(0.05, Math.min(1, (containerH - 32) / ((containerW - PAGE_GUTTER) * aspect)))
      : 1;
  const zoom =
    fitMode === "width" ? 1 : fitMode === "page" ? fitPageZoom : (liveZoom ?? manualZoom);
  const pageW = Math.max(200, (containerW - PAGE_GUTTER) * zoom);
  const pageH = book ? pageW * aspect : 0;

  useEffect(() => {
    useNavigationStore.getState().setPdfEffectiveZoom(bookId, zoom);
  }, [bookId, zoom]);

  const currentPdfPosition = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!book || pageH <= 0 || !scroller) return null;
    const renderedPosition = renderedPdfPosition(scroller);
    if (renderedPosition) {
      return {
        page: Math.min(renderedPosition.page, book.pageCount),
        scrollRatio: renderedPosition.scrollRatio,
      };
    }
    const page = topPageAt(scroller.scrollTop, pageH, book.pageCount);
    return { page, scrollRatio: intraPageRatio(scroller.scrollTop, page, pageH) };
  }, [book, pageH]);

  const updateCurrentPageContext = (page: number) => {
    const chapterId = chapterIdAtPage(chapters, page);
    const chapter = chapterId ? chapters.find((item) => item.id === chapterId) : null;
    const pageCount = book?.pageCount ?? 0;
    const chapterTitle = chapter?.title ?? null;
    const previous = useNavigationStore.getState().readingContext;
    // Virtuoso can report the same range again after measuring a page. Publishing a new
    // context for an unchanged page rerenders ReaderView during that measurement cycle.
    if (
      previous?.format !== "pdf" ||
      previous.page !== page ||
      previous.pageCount !== pageCount ||
      previous.chapterId !== chapterId ||
      previous.chapterTitle !== chapterTitle
    ) {
      setReadingContext({ format: "pdf", page, pageCount, chapterId, chapterTitle });
    }
    if (book) recordPageRead(page, book.pageCount);
    if (chapterId) {
      topChapterIdRef.current = chapterId;
      if (chapterId !== useNavigationStore.getState().currentChapterId)
        setCurrentChapter(chapterId);
    }
  };

  const jumpToPdfPosition = useCallback(
    (target: { page: number; scrollRatio: number }, record = true) => {
      if (!book || pageH <= 0) return;
      const page = Math.min(Math.max(Math.round(target.page), 1), book.pageCount);
      const scrollRatio = Math.min(Math.max(target.scrollRatio, 0), 0.999);
      const from = currentPdfPosition();
      if (record && from && sawInitialRange.current) {
        useNavigationStore.getState().recordPdfJump(bookId, from, { page, scrollRatio });
      }
      const scroller = scrollerRef.current;
      // Land on the page content, past its 8px top padding. At the item boundary,
      // positionAtViewportTop still considers the gap part of the previous page.
      virtuosoRef.current?.scrollToIndex({
        index: page - 1,
        align: "start",
        offset: PAGE_PADDING_Y + scrollRatio * pageH,
      });
      if (scroller) {
        const alignToPageRatio = (attempt: number) => {
          requestAnimationFrame(() => {
            const layer = containerRef.current?.querySelector<HTMLElement>(
              `.textLayer[data-page="${page}"]`,
            );
            if (!layer) {
              if (attempt < 12) alignToPageRatio(attempt + 1);
              return;
            }
            const pageRect = layer.getBoundingClientRect();
            const scrollerTop = scroller.getBoundingClientRect().top;
            if (pageRect.height <= 0) {
              if (attempt < 12) alignToPageRatio(attempt + 1);
              return;
            }
            scroller.scrollTop +=
              pageRect.top - scrollerTop + Math.min(scrollRatio, 0.999) * pageRect.height;
            // Virtuoso may report its new range before the target page finishes layout. Its
            // scrollTop estimate can point at an old page number; after aligning to the real
            // page geometry, run the normal scroll path so page context and saved progress agree.
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          });
        };
        alignToPageRatio(0);
      }
    },
    [book, bookId, pageH, currentPdfPosition],
  );

  const jumpToThumbnailPage = useCallback(
    (page: number) => jumpToPdfPosition({ page, scrollRatio: 0 }),
    [jumpToPdfPosition],
  );

  useEffect(() => {
    if (!book) {
      onNavigationChange?.(null);
      return;
    }
    onNavigationChange?.({
      bookId,
      book,
      currentPage,
      rotation,
      invert: invertPdfPages,
      brightness: pdfBrightness,
      onJump: jumpToThumbnailPage,
    });
  }, [
    bookId,
    book,
    currentPage,
    rotation,
    invertPdfPages,
    pdfBrightness,
    jumpToThumbnailPage,
    onNavigationChange,
  ]);

  useEffect(() => () => onNavigationChange?.(null), [onNavigationChange]);

  const goHistory = useCallback(
    (direction: "back" | "forward") => {
      const current = currentPdfPosition();
      if (!current) return;
      const state = useNavigationStore.getState();
      const target =
        direction === "back"
          ? state.goPdfBack(bookId, current)
          : state.goPdfForward(bookId, current);
      if (target) jumpToPdfPosition(target, false);
    },
    [bookId, currentPdfPosition, jumpToPdfPosition],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" && backCount > 0) {
        event.preventDefault();
        goHistory("back");
      } else if (event.key === "ArrowRight" && forwardCount > 0) {
        event.preventDefault();
        goHistory("forward");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backCount, forwardCount, goHistory]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === containerRef.current) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const setSelection = useAnnotationStore((s) => s.setSelection);
  const closeStyleBar = useAnnotationStore((s) => s.closeStyleBar);
  const closeNoteHover = useNoteHoverStore((s) => s.closeNow);

  const bytes = useQuery({
    queryKey: qk.bookBytes(bookId),
    queryFn: () => window.api.library.readBookBytes({ bookId }),
    staleTime: Infinity,
  });

  // Khi mở sách, đổi locator tiến độ (pdf:JSON) thành chỉ số trang một lần.
  const progress = useQuery({
    queryKey: qk.progress(bookId),
    queryFn: () => window.api.progress.get({ bookId }),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!progress.isPending) setReadingPercent(progress.data?.percent ?? 0);
  }, [progress.data?.percent, progress.isPending, setReadingPercent]);

  useLayoutEffect(() => {
    if (progress.isPending || appliedBookZoom.current === bookId) return;
    appliedBookZoom.current = bookId;
    const saved = progress.data?.locator ? parsePdfLocator(progress.data.locator) : null;
    if (saved?.zoom) usePrefsStore.setState({ pdfZoom: clampPdfZoomScale(saved.zoom) });
    if (saved?.viewMode) setViewMode(saved.viewMode);
    if (saved?.fitMode) useNavigationStore.getState().setPdfFitMode(bookId, saved.fitMode);
    if (saved?.rotation) setRotation(saved.rotation);
  }, [bookId, progress.isPending, progress.data?.locator]);

  // Cấu hình truy vấn chú thích giống EpubReader; tạo, sửa hoặc xóa sẽ làm mới dữ liệu để vẽ lại.
  const annotations = useQuery({
    queryKey: qk.annotations(bookId),
    queryFn: () => window.api.annotations.listByBook({ bookId }),
    staleTime: Infinity,
  });
  const exportAnnotations = useMutation({
    mutationFn: async () => {
      if (!book) throw new Error("PDF chưa tải xong.");
      const bytes = await book.exportAnnotations(annotations.data ?? []);
      return window.api.library.exportAnnotatedPdf({ bookId, bytes });
    },
    onSuccess: (result) => {
      if (result.status === "saved")
        toast.success(t("reader.pdf.saveAnnotationsSuccess", "Đã lưu PDF có chú thích."));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : String(error));
    },
  });
  const vocabulary = useQuery({
    queryKey: qk.vocabulary(bookId),
    queryFn: () => window.api.vocabulary.list({ bookId }),
    staleTime: Infinity,
  });
  const createBookmark = useMutation({
    mutationFn: (input: { bookId: string; title: string; page: number; scrollRatio: number }) =>
      window.api.library.bookmarks.create(input),
    onSuccess: () => {
      setBookmarkPosition(null);
      setBookmarkNote("");
      void qc.invalidateQueries({ queryKey: qk.pdfBookmarks(bookId) });
      toast.success(t("reader.pdf.bookmarks.added"));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });
  const scrollCommand = useAnnotationStore((s) => s.scrollCommand);

  // ResizeObserver theo dõi chiều rộng khung để tính chế độ vừa chiều rộng.
  // Khi thiếu tệp, BookFileMissingPanel được trả về trước lúc containerRef gắn vào DOM.
  // Sau khi liên kết lại tệp (ok:false → true), đăng ký quan sát trên khung mới;
  // nếu không containerW có thể mãi bằng 0 và giao diện kẹt ở trạng thái đang tải.
  // Khung DOM được giữ lại khi chuyển giữa đang tải và đã tải, nên không cần gắn lại mỗi lần.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncSize = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setContainerW(next.width);
      setContainerH(next.height);
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(el);
    syncSize();
    return () => {
      ro.disconnect();
    };
  }, [bytes.data?.ok]);

  useEffect(() => {
    if (!bytes.data?.ok) return;
    const fileBytes = bytes.data.data;
    let alive = true;
    let created: PdfBook | null = null;
    setParseError(null);
    createPdfBook(fileBytes)
      .then((b) => {
        if (!alive) {
          b.destroy();
          return;
        }
        created = b;
        setBook(b);
      })
      .catch((err: unknown) => {
        if (alive) {
          log.error("pdf parse failed", err);
          setParseError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      alive = false;
      created?.destroy();
      setBook(null);
      // The book-specific cleanup below flushes any pending position before switching books.
      topChapterIdRef.current = null;
      sawInitialRange.current = false;
    };
  }, [bytes.data]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveSearch(null);
  }, [bookId]);

  useEffect(() => {
    if (!book) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!searchOpen) {
          const selectedText =
            window.getSelection()?.toString().trim().replace(/\s+/gu, " ").slice(0, 200) ?? "";
          if (selectedText) {
            setSearchQuery(selectedText);
            setActiveSearch(null);
          }
        }
        setSearchOpen(true);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setActiveSearch(null);
      } else if (
        !(
          event.target instanceof Element &&
          event.target.closest("input,textarea,[contenteditable='true']")
        )
      ) {
        const command = event.ctrlKey || event.metaKey;
        if (command && ["+", "=", "Add"].includes(event.key)) {
          event.preventDefault();
          useNavigationStore.getState().setPdfFitMode(bookId, "custom");
          usePrefsStore.getState().setPdfZoom(clampPdfZoom(zoom + PDF_ZOOM_STEP));
        } else if (command && ["-", "Subtract"].includes(event.key)) {
          event.preventDefault();
          useNavigationStore.getState().setPdfFitMode(bookId, "custom");
          usePrefsStore.getState().setPdfZoom(clampPdfZoom(zoom - PDF_ZOOM_STEP));
        } else if (command && event.key === "0") {
          event.preventDefault();
          useNavigationStore.getState().setPdfFitMode(bookId, "width");
          usePrefsStore.getState().setPdfZoom(1);
        } else if (!command && !event.altKey && ["PageDown", "PageUp"].includes(event.key)) {
          const current = currentPdfPosition();
          if (!current) return;
          event.preventDefault();
          const step = event.key === "PageDown" ? 1 : -1;
          jumpToPdfPosition({ page: current.page + step, scrollRatio: 0 }, false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [book, bookId, searchOpen, zoom, currentPdfPosition, jumpToPdfPosition]);

  const flushProgress = useCallback(
    (sync: boolean) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const input = pendingProgress.current;
      pendingProgress.current = null;
      if (!input) return;
      if (sync) {
        if (!window.api.progress.saveSync(input)) log.warn("synchronous progress save failed");
      } else {
        void window.api.progress
          .save(input)
          .catch((err: unknown) => log.warn("save progress failed", err));
      }
      qc.setQueryData<ProgressDto | null>(qk.progress(input.bookId), (previous) => ({
        locator: input.locator,
        percent: previous?.percent ?? null,
      }));
    },
    [qc],
  );

  const saveAt = useCallback(
    (page: number, scrollRatio: number) => {
      if (!persistProgress) return;
      pendingProgress.current = {
        bookId,
        locator: makePdfLocator({
          page,
          scrollRatio,
          zoom: manualZoom,
          viewMode,
          fitMode,
          rotation,
        }),
      };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushProgress(false), SAVE_DEBOUNCE_MS);
    },
    [bookId, persistProgress, flushProgress, manualZoom, viewMode, fitMode, rotation],
  );

  useEffect(() => {
    if (!book || appliedBookZoom.current !== bookId || !sawInitialRange.current) return;
    const timer = setTimeout(() => {
      const current = currentPdfPosition();
      if (current) saveAt(current.page, current.scrollRatio);
    }, 350);
    return () => clearTimeout(timer);
  }, [book, bookId, zoom, viewMode, rotation, fitMode, currentPdfPosition, saveAt]);

  useEffect(() => {
    const onBeforeUnload = () => flushProgress(true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushProgress(false);
    };
  }, [bookId, flushProgress]);

  // Khi chọn chương trong ChapterList, cuộn đến trang đầu của chương.
  useEffect(() => {
    if (!book || currentChapterId == null) return;
    if (currentChapterId === topChapterIdRef.current) return; // Thay đổi do cuộn, không cuộn ngược lại.
    const ch = chapters.find((c) => c.id === currentChapterId);
    if (ch?.startPage == null) return;
    jumpToPdfPosition({ page: ch.startPage, scrollRatio: 0 });
  }, [book, currentChapterId, chapters, jumpToPdfPosition]);

  // Nhấn chú thích ở thanh bên sẽ cuộn đến trang tương ứng như lệnh scrollCommand của EpubReader.
  // Locator không thuộc PDF được phân tích thành null rồi bỏ qua, tránh lẫn với locator ePub.
  useEffect(() => {
    if (!book || !scrollCommand || (scrollCommand.bookId && scrollCommand.bookId !== bookId))
      return;
    const commandKey = `${bookId}:${scrollCommand.nonce}`;
    if (consumedScrollCommand.current === commandKey) return;
    const range = parsePdfLocatorRange(scrollCommand.locator);
    const location = parsePdfLocator(scrollCommand.locator);
    const page = range?.page ?? location?.page;
    if (page == null) return;
    consumedScrollCommand.current = commandKey;
    const safePage = Math.min(Math.max(page, 1), book.pageCount);
    jumpToPdfPosition({ page: safePage, scrollRatio: range ? 0 : (location?.scrollRatio ?? 0) });
    if (scrollCommand.citation)
      setCitationFlash({
        page: safePage,
        quote: scrollCommand.citationQuote?.trim() || null,
        nonce: scrollCommand.nonce,
      });
    else setCitationFlash(null);
  }, [book, bookId, scrollCommand, jumpToPdfPosition]);

  useEffect(() => {
    if (citationFlash == null) return;
    const timer = setTimeout(() => setCitationFlash(null), 2500);
    return () => clearTimeout(timer);
  }, [citationFlash]);

  // Dọn lớp .selecting qua listener capture trên document: thả chuột ngoài khung không gọi onMouseUp của khung.
  // Nếu lớp này còn lại, lớp liên kết của trang sẽ không nhận sự kiện pointer và liên kết không thể nhấn.
  useEffect(() => {
    const clearSelecting = () => {
      containerRef.current
        ?.querySelectorAll(".textLayer.selecting")
        .forEach((el) => el.classList.remove("selecting"));
    };
    document.addEventListener("mouseup", clearSelecting, true);
    return () => document.removeEventListener("mouseup", clearSelecting, true);
  }, []);

  // Từ vùng chọn DOM của textLayer trong cùng tài liệu, lấy vị trí ký tự trong trang và ngữ cảnh xung quanh.
  const onMouseUp = () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const startEl =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    const layer = startEl?.closest<HTMLElement>(".textLayer");
    if (!layer || !containerRef.current?.contains(layer)) return;
    const page = Number(layer.dataset.page);
    if (!Number.isInteger(page) || page < 1) return;
    const start = flatOffsetOf(layer, range.startContainer, range.startOffset);
    const endEl =
      range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement;
    // Vùng chọn qua nhiều trang không có vị trí kết thúc trong cùng textLayer; locatorRange là null nhưng vẫn hỏi AI được.
    const end =
      endEl?.closest(".textLayer") === layer
        ? flatOffsetOf(layer, range.endContainer, range.endOffset)
        : null;
    const r = range.getBoundingClientRect();
    setSelection(
      buildPdfSelectionInfo({
        page,
        pageStr: layer.textContent ?? "",
        contextPageStr: layer.innerText,
        start,
        end,
        selectionText: sel.toString(),
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      }),
    );
  };
  // Nhấn chuột trong nội dung sẽ đóng thanh kiểu và xóa vùng chọn, giống EpubReader.
  // Ngoại lệ: nhấn bên trong vùng chọn hiện có thì ngăn trình duyệt thu gọn vùng chọn, giữ state.
  // Mouseup sau đó tạo lại SelectionInfo để thanh công cụ hiện ở vị trí mới.
  const onMouseDown = (e: ReactMouseEvent) => {
    if (pointInDomSelection(e.clientX, e.clientY)) {
      e.preventDefault();
      return;
    }
    const targetLayer = (e.target as Element | null)?.closest<HTMLElement>(".textLayer");
    targetLayer?.classList.add("selecting");
    closeStyleBar();
    setSelection(null);
  };

  // Cuộn vùng đọc thì bỏ vùng chọn vì vị trí neo của các thanh công cụ không còn đúng, giống EpubReader.
  // Cuộn bên trong bảng kết quả từ điển không xóa vùng chọn; listener capture trên document nhận được cuộn của Virtuoso.
  useEffect(() => {
    const onScroll = (e: Event) => {
      if (!shouldDismissPdfSelectionOnScroll(e.target)) return;
      const scroller = scrollerRef.current;
      if (scroller && e.target === scroller) {
        // Cập nhật ảnh chụp scrollTop trước khi phóng đại mỗi khi người dùng chủ động cuộn.
        lastScrollTopRef.current = scroller.scrollTop;
        lastScrollLeftRef.current = scroller.scrollLeft;
        // rangeChanged only reports changes to the rendered page range. Track scrolls within
        // the same page as well, otherwise its final reading position never reaches storage.
        if (book && pageH > 0 && sawInitialRange.current && !progress.isPending) {
          const position = renderedPdfPosition(scroller);
          const page = position?.page ?? topPageAt(scroller.scrollTop, pageH, book.pageCount);
          const scrollRatio =
            position?.scrollRatio ?? intraPageRatio(scroller.scrollTop, page, pageH);
          const readingContext = useNavigationStore.getState().readingContext;
          if (readingContext?.format !== "pdf" || readingContext.page !== page) {
            updateCurrentPageContext(page);
          }
          saveAt(page, scrollRatio);
        }
      }
      closeStyleBar();
      setSelection(null);
      closeNoteHover();
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [
    book,
    pageH,
    progress.isPending,
    saveAt,
    closeStyleBar,
    setSelection,
    closeNoteHover,
    updateCurrentPageContext,
  ]);

  const setPdfZoom = usePrefsStore((s) => s.setPdfZoom);
  // Ctrl + con lăn hoặc chụm trên bàn di chuột để phóng đại; giữ giá trị chính xác trong ref.
  // Không làm tròn theo bước 1% để thao tác chậm vẫn tích lũy; mỗi frame cập nhật tối đa một lần qua rAF.
  // useLayoutEffect bên dưới khôi phục vị trí cuộn; wheel ghi tọa độ con trỏ làm điểm neo.
  const zoomTargetRef = useRef(zoom);
  // Sự kiện wheel cũng ghi trang thực tế và vị trí trong trang, tránh suy ra từ scrollTop đã cũ.
  const zoomAnchorRef = useRef<{
    anchorX: number;
    anchorY: number;
    page: number | null;
    ratio: number | null;
  } | null>(null);
  const zoomRafRef = useRef(0);
  const zoomSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dùng hình học trước khi phóng đại để khôi phục điểm neo chỉ khi zoom đổi, không áp dụng khi đổi cỡ cửa sổ.
  const prevPageHRef = useRef(pageH);
  const prevZoomRef = useRef(zoom);
  const prevRotationRef = useRef(rotation);
  // Các lần cập nhật gần nhau thuộc cùng một thao tác phóng đại. Khóa điểm neo và hình học ban đầu ở frame đầu.
  // Các frame sau dùng scrollToIndex để trở về điểm đó, không đọc lại scrollTop hoặc pageH đang thay đổi.
  // Khi chụm liên tục, scrollToIndex chạy bất đồng bộ còn pageH cập nhật theo React state từng frame;
  // đọc lại hai giá trị lệch pha sẽ khiến trang bị trôi.
  const zoomGestureRef = useRef<{
    page: number;
    ratio: number;
    anchorX: number;
    anchorY: number;
    baseScrollLeft: number;
    basePageH: number;
  } | null>(null);
  const lastZoomAtRef = useRef(0);
  // Ảnh chụp scrollTop/Left ổn định trước thao tác, kết hợp oldPageH để khóa điểm neo ở frame đầu.
  // Sự kiện scroll và rangeChanged duy trì ảnh chụp; không đọc scrollTop có thể đã lệch với pageH trong layout effect.
  const lastScrollTopRef = useRef(0);
  const lastScrollLeftRef = useRef(0);

  // Khi nút hoặc ô nhập của PdfPrefs đổi zoom, đặt lại mục tiêu chính xác. Trong lúc thao tác,
  // giữ ref để các bước nhỏ hơn 1% tiếp tục được cộng dồn.
  useEffect(() => {
    if (liveZoom != null) return;
    if (Math.abs(zoom - zoomTargetRef.current) > 1e-6) {
      zoomTargetRef.current = zoom;
    }
  }, [liveZoom, zoom]);

  // onWheel tổng hợp của React là passive nên dùng listener DOM để chặn phóng đại mặc định.
  // Gắn vào containerRef vì khung này tồn tại xuyên suốt lúc tải; sự kiện wheel nổi bọt từ scroller tới đó.
  // Scroller chiếm toàn khung nên cùng hệ tọa độ. Ghi điểm neo từ scroller và textLayer;
  // layout effect bên dưới khôi phục vị trí.
  useEffect(() => {
    const container = containerRef.current;
    if (!book || !container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const scroller = scrollerRef.current;
      const rect = scroller?.getBoundingClientRect() ?? container.getBoundingClientRect();
      const insideScroller =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      const anchorX =
        insideScroller && scroller
          ? e.clientX - rect.left
          : (scroller?.clientWidth ?? rect.width) / 2;
      const anchorY =
        insideScroller && scroller
          ? e.clientY - rect.top
          : (scroller?.clientHeight ?? rect.height) / 2;
      const position = scroller ? renderedPdfPosition(scroller, rect.top + anchorY) : null;
      if (zoomSettleTimerRef.current == null) {
        useNavigationStore.getState().setPdfFitMode(bookId, "custom");
      }
      zoomTargetRef.current = nextZoom(zoomTargetRef.current, e.deltaY);
      zoomAnchorRef.current = {
        anchorX,
        anchorY,
        page: position?.page ?? null,
        ratio: position?.scrollRatio ?? null,
      };
      if (!zoomRafRef.current) {
        zoomRafRef.current = requestAnimationFrame(() => {
          zoomRafRef.current = 0;
          setLiveZoom(clampPdfZoomScale(zoomTargetRef.current));
        });
      }
      if (zoomSettleTimerRef.current) clearTimeout(zoomSettleTimerRef.current);
      zoomSettleTimerRef.current = setTimeout(() => {
        zoomSettleTimerRef.current = null;
        const settledZoom = clampPdfZoomScale(zoomTargetRef.current);
        zoomTargetRef.current = settledZoom;
        setPdfZoom(settledZoom);
        setLiveZoom(null);
      }, ZOOM_SETTLE_MS);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (zoomRafRef.current) {
        cancelAnimationFrame(zoomRafRef.current);
        zoomRafRef.current = 0;
      }
      if (zoomSettleTimerRef.current) {
        clearTimeout(zoomSettleTimerRef.current);
        zoomSettleTimerRef.current = null;
        setPdfZoom(clampPdfZoomScale(zoomTargetRef.current));
      }
    };
  }, [book, bookId, setPdfZoom]);

  // Sau khi đổi zoom bằng con lăn, chụm, nút hoặc ô nhập, khôi phục vị trí theo con trỏ hay tâm khung nhìn.
  // Chiều dọc dùng scrollToIndex của Virtuoso; gán trực tiếp scrollTop sẽ bị lần resize sau ghi đè.
  // Chiều ngang do Virtuoso không quản lý nên gán scrollLeft. Chỉ khôi phục khi zoom đổi;
  // lúc đổi cỡ cửa sổ, để Virtuoso giữ neo mặc định ở đầu trang.
  // Trong layout effect này, scrollTop còn là giá trị cũ; kết hợp oldPageH để suy ra trang và tỉ lệ vị trí neo.
  useLayoutEffect(() => {
    const oldPageH = prevPageHRef.current;
    const zoomChanged = Math.abs(zoom - prevZoomRef.current) > 1e-9;
    const rotationChanged = rotation !== prevRotationRef.current;
    prevPageHRef.current = pageH;
    prevZoomRef.current = zoom;
    prevRotationRef.current = rotation;
    const wheelPx = zoomAnchorRef.current;
    zoomAnchorRef.current = null;

    if (!book || (!zoomChanged && !rotationChanged) || pageH <= 0 || oldPageH <= 0) return;
    const scroller = scrollerRef.current;
    const virtuoso = virtuosoRef.current;
    if (!scroller || !virtuoso) return;

    const now = performance.now();
    const newGesture =
      rotationChanged ||
      now - lastZoomAtRef.current > ZOOM_GESTURE_GAP_MS ||
      !zoomGestureRef.current;
    lastZoomAtRef.current = now;
    if (newGesture) {
      // Ở frame đầu, ưu tiên hình học textLayer ghi tại sự kiện wheel. Với nút phóng đại không có neo wheel,
      // ước tính bằng pageH cũ và ảnh chụp cuộn vì Virtuoso có thể cập nhật scrollTop sau lần đổi zoom.
      const anchorX = wheelPx?.anchorX ?? scroller.clientWidth / 2;
      const anchorY = wheelPx?.anchorY ?? scroller.clientHeight / 2;
      const absY = lastScrollTopRef.current + anchorY;
      const page = wheelPx?.page ?? topPageAt(absY, oldPageH, book.pageCount);
      zoomGestureRef.current = {
        page,
        ratio: wheelPx?.ratio ?? intraPageRatio(absY, page, oldPageH),
        anchorX,
        anchorY,
        baseScrollLeft: lastScrollLeftRef.current,
        basePageH: oldPageH,
      };
    }
    const g = zoomGestureRef.current;
    if (!g) return;
    // Mỗi frame đưa cùng một điểm nội dung về cùng pixel trong khung nhìn: dùng Virtuoso cho chiều dọc,
    // gán scrollLeft cho chiều ngang. Không đọc scrollTop hiện tại để tránh lệch pha khi phóng đại liên tục.
    virtuoso.scrollToIndex({
      index: g.page - 1,
      align: "start",
      offset: zoomScrollOffset(g.ratio, pageH, g.anchorY),
    });
    scroller.scrollLeft = zoomScrollLeft(g.baseScrollLeft, g.anchorX, pageH / g.basePageH);
  }, [pageH, zoom, rotation, book]);

  if (bytes.data?.ok === false) return <BookFileMissingPanel bookId={bookId} />;
  if (bytes.isError) {
    return <p className="p-6 font-sans text-sm text-destructive">{t("reader.epub.loadError")}</p>;
  }
  if (parseError) {
    return (
      <p className="p-6 font-sans text-sm text-destructive">
        {t("reader.pdf.parseError", "Không thể đọc PDF: {{error}}", { error: parseError })}
      </p>
    );
  }
  if (!book || progress.isPending || containerW === 0) {
    return (
      <div ref={containerRef} className="h-full">
        <p className="p-6 font-sans text-sm text-muted-foreground">{t("reader.epub.loading")}</p>
      </div>
    );
  }

  // Nhóm chú thích theo trang; chi phí theo số trang hiển thị và số chú thích, React Compiler cũng có thể cache.
  const annosByPage = pdfAnnosByPage(annotations.data ?? []);

  // Từ trang và tỉ lệ vị trí trong trang, tính scrollTop chính xác vì mọi trang được giả định cùng cỡ.
  // Đầu trang đầu tiên phải trả 0; scrollTopFor(1, 0) là 8px do khoảng đệm py-2.
  const initialScrollTop = (() => {
    const loc = progress.data?.locator ? parsePdfLocator(progress.data.locator) : null;
    if (!loc) return 0;
    const page = Math.min(Math.max(loc.page, 1), book.pageCount);
    const ratio = Math.min(Math.max(loc.scrollRatio, 0), 1);
    return page === 1 && ratio === 0 ? 0 : scrollTopFor(page, ratio, pageH);
  })();

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full", isFullscreen && "h-screen bg-background")}
      onMouseUp={onMouseUp}
      onMouseDown={onMouseDown}
    >
      <div className="absolute top-3 right-3 z-40 flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          disabled={createBookmark.isPending}
          onClick={() => {
            setBookmarkNote("");
            setBookmarkPosition(currentPdfPosition());
          }}
          aria-label={t("reader.pdf.bookmarks.add")}
          title={t("reader.pdf.bookmarks.add")}
        >
          <BookmarkPlus />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setSearchOpen((open) => !open)}
          aria-label={t("reader.pdf.search.title")}
          title={t("reader.pdf.search.title")}
        >
          <Search />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("reader.pdf.more", "More reading options")}
                title={t("reader.pdf.more", "More reading options")}
              />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  setRotation((current) => ((current + 90) % 360) as 0 | 90 | 180 | 270)
                }
              >
                <RotateCw />
                {t("reader.pdf.rotateClockwise")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void toggleFullscreen()}>
                {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                {isFullscreen ? t("reader.pdf.fullscreen.exit") : t("reader.pdf.fullscreen.enter")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setViewMode((mode) => (mode === "continuous" ? "single" : "continuous"))
                }
              >
                {viewMode === "continuous"
                  ? t("reader.pdf.view.single")
                  : t("reader.pdf.view.continuous")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={backCount === 0} onClick={() => goHistory("back")}>
                <ArrowLeft />
                {t("reader.pdf.history.back")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={forwardCount === 0} onClick={() => goHistory("forward")}>
                <ArrowRight />
                {t("reader.pdf.history.forward")}
              </DropdownMenuItem>
              {annotations.data && annotations.data.length > 0 && (
                <DropdownMenuItem
                  disabled={exportAnnotations.isPending}
                  onClick={() => exportAnnotations.mutate()}
                >
                  {exportAnnotations.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Download />
                  )}
                  {t("reader.pdf.saveAnnotations", "Lưu PDF có chú thích")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {searchOpen && (
        <PdfSearchPanel
          book={book}
          query={searchQuery}
          options={searchOptions}
          onQueryChange={(query) => {
            setSearchQuery(query);
            setActiveSearch(null);
          }}
          onOptionsChange={(options) => {
            setSearchOptions(options);
            setActiveSearch(null);
          }}
          onJump={(result: PdfSearchResult) => {
            setActiveSearch({ page: result.page, ordinal: result.ordinal });
            jumpToPdfPosition({ page: result.page, scrollRatio: 0 });
          }}
          onClose={() => {
            setSearchOpen(false);
            setActiveSearch(null);
          }}
        />
      )}
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={(el) => {
          const scroller = el instanceof HTMLElement ? el : null;
          scrollerRef.current = scroller;
          if (scroller) scroller.style.scrollSnapType = viewMode === "single" ? "y mandatory" : "";
        }}
        className="reader-scroll-region h-full"
        style={{ backgroundColor: pdfBackdrop, backgroundImage: pdfBackdropOverlay }}
        totalCount={book.pageCount}
        initialItemCount={1}
        defaultItemHeight={pageH + 16}
        increaseViewportBy={{ top: pageH, bottom: pageH }}
        initialScrollTop={initialScrollTop}
        rangeChanged={(range) => {
          // rangeChanged.startIndex includes overscan pages. Resolve the top page from the
          // rendered text-layer rectangles; the virtual spacer's scrollTop estimate can drift
          // from the actual page layout after a resize or zoom.
          const scrollTop = scrollerRef.current?.scrollTop;
          if (scrollTop != null) {
            // Giữ ảnh chụp vị trí cuộn để khôi phục zoom, gồm cả initialScrollTop ở lần gọi đầu.
            // Callback này chạy sau layout effect nên ghi giá trị ổn định, làm mốc cho lần phóng đại kế tiếp.
            lastScrollTopRef.current = scrollTop;
            lastScrollLeftRef.current = scrollerRef.current?.scrollLeft ?? 0;
          }
          const position = scrollerRef.current ? renderedPdfPosition(scrollerRef.current) : null;
          const page =
            position?.page ??
            (scrollTop != null
              ? topPageAt(scrollTop, pageH, book.pageCount)
              : range.startIndex + 1);
          const ratio =
            position?.scrollRatio ??
            (scrollTop != null ? intraPageRatio(scrollTop, page, pageH) : 0);
          // Cập nhật chương hiện tại, kể cả lần đầu để thanh bên đánh dấu đúng chương sau khi khôi phục tiến độ.
          updateCurrentPageContext(page);
          if (!sawInitialRange.current) {
            sawInitialRange.current = true;
            return; // Lần đầu không phải người dùng cuộn nên không lưu tiến độ.
          }
          saveAt(page, ratio);
        }}
        // Key chỉ dùng index mặc định, không thêm pageW. Khi zoom đổi, effect cssWidth của PdfPage
        // hủy render cũ rồi vẽ lại canvas tại chỗ theo độ phân giải mới.
        // Giữ nguyên danh sách để Virtuoso không gắn lại và ghi đè scrollToIndex vừa khôi phục vị trí.
        itemContent={(index) => (
          <PdfPage
            book={book}
            index={index}
            cssWidth={pageW}
            cssHeight={pageH}
            rotation={rotation}
            invert={invertPdfPages}
            brightness={pdfBrightness}
            annos={annosByPage.get(index + 1) ?? EMPTY_PDF_ANNOS}
            vocabulary={
              vocabularyVisible ? (vocabulary.data ?? EMPTY_VOCABULARY) : EMPTY_VOCABULARY
            }
            searchQuery={searchOpen ? searchQuery : ""}
            searchOptions={searchOptions}
            searchActiveOrdinal={activeSearch?.page === index + 1 ? activeSearch.ordinal : null}
            singlePage={viewMode === "single"}
            citationFlash={citationFlash?.page === index + 1}
            citationQuote={citationFlash?.page === index + 1 ? citationFlash.quote : null}
            onSearchMatchReady={revealSearchMatch}
            onCitationMatchReady={revealSearchMatch}
            bookId={bookId}
            onLinkPage={(pageNumber) => jumpToPdfPosition({ page: pageNumber, scrollRatio: 0 })}
          />
        )}
      />
      <Dialog
        open={bookmarkPosition != null}
        onOpenChange={(open) => {
          if (!open && !createBookmark.isPending) {
            setBookmarkPosition(null);
            setBookmarkNote("");
          }
        }}
      >
        <DialogContent className="font-sans">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const note = bookmarkNote.trim();
              if (!bookmarkPosition || !note || createBookmark.isPending) return;
              createBookmark.mutate({ bookId, title: note, ...bookmarkPosition });
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("reader.pdf.bookmarks.noteTitle")}</DialogTitle>
              <DialogDescription>
                {t("reader.pdf.bookmarks.noteDescription", {
                  page: bookmarkPosition?.page ?? "",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="pdf-bookmark-note">
                {t("reader.pdf.bookmarks.noteLabel")} <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="pdf-bookmark-note"
                autoFocus
                required
                maxLength={500}
                rows={4}
                value={bookmarkNote}
                onChange={(event) => setBookmarkNote(event.target.value)}
                placeholder={t("reader.pdf.bookmarks.notePlaceholder")}
                className="min-h-24 resize-y leading-relaxed"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={createBookmark.isPending}
                onClick={() => {
                  setBookmarkPosition(null);
                  setBookmarkNote("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!bookmarkNote.trim() || createBookmark.isPending}>
                {createBookmark.isPending && <LoaderCircle className="animate-spin" />}
                {t("reader.pdf.bookmarks.noteSave")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Một trang gồm canvas, lớp tô sáng và textLayer; hủy render dở khi tháo trang hoặc đổi tham số. */
function PdfPage(props: {
  book: PdfBook;
  index: number;
  cssWidth: number;
  cssHeight: number;
  rotation: 0 | 90 | 180 | 270;
  invert: boolean;
  brightness: number;
  annos: PdfPageAnno[];
  vocabulary: VocabularyEntryDto[];
  searchQuery: string;
  searchOptions: PdfSearchOptions;
  searchActiveOrdinal: number | null;
  singlePage: boolean;
  citationFlash: boolean;
  citationQuote: string | null;
  onSearchMatchReady: (rect: DOMRect) => void;
  onCitationMatchReady: (rect: DOMRect) => void;
  bookId: string;
  onLinkPage: (pageNumber: number) => void;
}) {
  const { t } = useTranslation();
  const {
    book,
    index,
    cssWidth,
    cssHeight,
    rotation,
    invert,
    brightness,
    annos,
    vocabulary,
    searchQuery,
    searchOptions,
    searchActiveOrdinal,
    singlePage,
    citationFlash,
    citationQuote,
    onSearchMatchReady,
    onCitationMatchReady,
    bookId,
    onLinkPage,
  } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const annotationLayerRef = useRef<HTMLDivElement | null>(null);
  const autoLinkLayerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState(false);
  // Khi canvas và textLayer đều hoàn tất, có thể chuyển vị trí ký tự về Range an toàn.
  const [textReady, setTextReady] = useState(false);
  const openStyleBar = useAnnotationStore((s) => s.openStyleBar);
  const hasActiveSelection = useAnnotationStore((s) => s.selection !== null);
  const hoverHighlight = useNoteHoverStore((s) => s.hoverHighlight);
  const leaveHighlight = useNoteHoverStore((s) => s.leaveHighlight);
  const lastNotedId = useRef<string | null>(null);
  const highlights = usePdfHighlights(annos, textLayerRef.current, textReady);
  const vocabularyMarks = usePdfVocabulary(vocabulary, index + 1, textLayerRef.current, textReady);
  const searchMarks = usePdfSearchMarks(
    textLayerRef.current,
    textReady,
    searchQuery,
    searchOptions,
  );
  const citationMarks = usePdfSearchMarks(
    textLayerRef.current,
    textReady,
    citationQuote ?? "",
    CITATION_SEARCH_OPTIONS,
  );
  useEffect(() => {
    if (!textReady || searchActiveOrdinal == null || !searchQuery.trim()) return;
    const frame = requestAnimationFrame(() => {
      const layer = textLayerRef.current;
      if (!layer) return;
      const match = findPdfTextMatches(layer.textContent ?? "", searchQuery, searchOptions)[
        searchActiveOrdinal
      ];
      if (!match) return;
      const range = rangeFromOffsets(layer, match.start, match.end);
      if (range) onSearchMatchReady(range.getBoundingClientRect());
    });
    return () => cancelAnimationFrame(frame);
  }, [textReady, searchActiveOrdinal, searchQuery, searchOptions, onSearchMatchReady]);
  useEffect(() => {
    if (!textReady || !citationQuote) return;
    const frame = requestAnimationFrame(() => {
      const layer = textLayerRef.current;
      if (!layer) return;
      const match = findPdfTextMatches(
        layer.textContent ?? "",
        citationQuote,
        CITATION_SEARCH_OPTIONS,
      )[0];
      if (!match) return;
      const range = rangeFromOffsets(layer, match.start, match.end);
      if (range) onCitationMatchReady(range.getBoundingClientRect());
    });
    return () => cancelAnimationFrame(frame);
  }, [textReady, citationQuote, onCitationMatchReady]);
  const [hoveredWord, setHoveredWord] = useState<VocabularyMark | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState(false);
  const [occurrenceMeaning, setOccurrenceMeaning] = useState("");
  useEffect(() => {
    if (hasActiveSelection) setHoveredWord(null);
  }, [hasActiveSelection]);
  useEffect(() => {
    if (vocabulary.length > 0) return;
    setHoveredWord(null);
    setEditingOccurrence(false);
  }, [vocabulary.length]);
  const qc = useQueryClient();
  const occurrenceM = useMutation({
    mutationFn: window.api.vocabulary.setOccurrence,
    onSuccess: () => {
      setEditingOccurrence(false);
      void qc.invalidateQueries({ queryKey: qk.vocabulary(bookId) });
    },
  });
  const [autoLinks, setAutoLinks] = useState<PdfAutoLink[]>([]);

  // Lần đầu hoặc khi cuộn sang trang mới thì vẽ ngay. Khi zoom cùng trang, chờ ngắn trước khi vẽ lại;
  // CSS kéo giãn bitmap cũ trong lúc chờ. Vẽ vào canvas ngoài màn hình rồi chuyển bằng drawImage,
  // tránh frame trắng do gán canvas.width làm trống canvas đang hiển thị.
  const renderedWidthRef = useRef<number | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    // done vẫn resolve khi hủy theo hợp đồng pdf-book. Sau khi effect chạy lại hoặc tháo trang,
    // task cũ không được cập nhật state hay thay canvas, nếu không textReady có thể bật quá sớm.
    let stale = false;
    let task: {
      done: Promise<void>;
      canvasReady: Promise<void>;
      cancel: () => void;
    } | null = null;
    const doRender = () => {
      if (stale) return;
      setRenderError(false);
      setTextReady(false);
      const offscreen = document.createElement("canvas");
      task = book.renderPage(
        index,
        offscreen,
        cssWidth,
        textLayerRef.current ?? undefined,
        annotationLayerRef.current ?? undefined,
        onLinkPage,
        rotation,
      );
      void task.canvasReady
        .then(() => {
          if (stale) return;
          const vis = canvasRef.current;
          if (!vis || offscreen.width <= 0) return;
          // Show the bitmap as soon as PDF.js has painted it. Text/annotation readiness still gates
          // selection geometry, but a slow annotation layer must not leave the page blank.
          vis.width = offscreen.width;
          vis.height = offscreen.height;
          vis.getContext("2d")?.drawImage(offscreen, 0, 0);
          renderedWidthRef.current = cssWidth;
        })
        .catch(() => {
          // `done` below logs the render failure and displays the page error state.
        });
      task.done
        .then(() => {
          if (stale) return;
          setAutoLinks(buildPdfAutoLinks(textLayerRef.current, autoLinkLayerRef.current));
          setTextReady(true);
        })
        .catch((error: unknown) => {
          if (stale) return;
          log.warn(`page ${index + 1} render failed`, error);
          setRenderError(true);
        });
    };
    // Trang đã vẽ thì chờ ngắn khi zoom và kéo giãn ảnh cũ; trang chưa vẽ thì hiển thị ngay.
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (renderedWidthRef.current == null) doRender();
    else timer = setTimeout(doRender, RENDER_DEBOUNCE_MS);
    return () => {
      stale = true;
      if (timer) clearTimeout(timer);
      task?.cancel();
    };
  }, [book, index, cssWidth, rotation]);

  // Nhấn vùng tô sáng sẽ mở thanh chỉnh kiểu như ePub. Hình chữ nhật hiển thị không chặn chọn chữ;
  // kiểm tra điểm nhấn trên khung, bỏ qua khi vùng chọn vẫn mở vì đó là cuối thao tác kéo chọn.
  const onClick = (e: ReactMouseEvent) => {
    if ((e.target as Element | null)?.closest(".annotationLayer")) return;
    if (!(window.getSelection()?.isCollapsed ?? true)) return;
    const layer = textLayerRef.current;
    if (!layer || highlights.length === 0) return;
    const base = layer.getBoundingClientRect();
    const hit = hitHighlight(highlights, e.clientX - base.x, e.clientY - base.y);
    if (!hit) return;
    openStyleBar({
      rect: {
        x: hit.rect.left + base.x,
        y: hit.rect.top + base.y,
        width: hit.rect.width,
        height: hit.rect.height,
      },
      target: { type: "edit", annotationId: hit.annoId },
    });
  };

  // Rê lên chú thích hoặc vùng chọn sẽ đổi con trỏ; chú thích có ghi chú sẽ hiện thẻ xem nhanh.
  // Lớp phủ không nhận pointer nên kiểm tra điểm trỏ qua mousemove của khung.
  const onMouseMove = (e: ReactMouseEvent) => {
    if ((e.target as Element | null)?.closest(".vocabulary-popover")) return;
    const layer = textLayerRef.current;
    if (!layer) return;
    const base = layer.getBoundingClientRect();
    const hit =
      highlights.length > 0
        ? hitHighlight(highlights, e.clientX - base.x, e.clientY - base.y)
        : undefined;
    const word = hitVocabulary(vocabularyMarks, e.clientX - base.x, e.clientY - base.y);
    setHoveredWord(shouldShowVocabularyPreview(hasActiveSelection) ? (word ?? null) : null);
    const over =
      pointInDomSelection(e.clientX, e.clientY) || hit !== undefined || word !== undefined;
    if (over) layer.setAttribute("data-pointer", "");
    else layer.removeAttribute("data-pointer");

    const noted = hit?.hasNote ? hit : undefined;
    const id = noted?.annoId ?? null;
    if (id !== lastNotedId.current) {
      lastNotedId.current = id;
      if (noted) {
        hoverHighlight(noted.annoId, {
          x: noted.rect.left + base.x,
          y: noted.rect.top + base.y,
          width: noted.rect.width,
          height: noted.rect.height,
        });
      } else {
        leaveHighlight();
      }
    }
  };
  const onMouseLeave = () => {
    if (editingOccurrence) return;
    setHoveredWord(null);
    textLayerRef.current?.removeAttribute("data-pointer");
    if (lastNotedId.current !== null) {
      lastNotedId.current = null;
      leaveHighlight();
    }
  };

  return (
    // w-max và min-w-full cho phép trang rộng hơn khung khi zoom lớn để cuộn ngang tới mép trái;
    // trang hẹp vẫn chiếm đủ khung và được căn giữa. shrink-0 ngăn flex ép trang rộng lại.
    <div className={cn("flex w-max min-w-full justify-center py-2", singlePage && "snap-start")}>
      {renderError ? (
        <div
          className="flex shrink-0 items-center justify-center bg-muted font-sans text-xs text-muted-foreground"
          // Kích thước trang được tính trong lúc chạy.
          style={{ width: cssWidth, height: cssHeight }}
        >
          {t("reader.pdf.pageRenderError", "⚠ p.{{page}}", { page: index + 1 })}
        </div>
      ) : (
        <div
          className={cn(
            "relative shrink-0 shadow-sm transition-shadow duration-500",
            citationFlash && "ring-4 ring-primary/70",
          )}
          style={{ width: cssWidth, height: cssHeight }}
          onClick={onClick}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full"
            style={{ filter: pdfCanvasFilter(invert, brightness) }}
          />
          {/* Lớp tô sáng nằm trên canvas và dưới textLayer; chỉ hiển thị, không chặn thao tác chọn chữ. */}
          <div className="pointer-events-none absolute inset-0">
            {vocabularyMarks.map((mark) => (
              <div
                key={`${mark.entryId}-${mark.page}-${mark.start}-${mark.rect.top}`}
                className="absolute rounded-sm bg-violet-300/30"
                style={{
                  left: mark.rect.left,
                  top: mark.rect.top,
                  width: mark.rect.width,
                  height: mark.rect.height,
                }}
              />
            ))}
            {highlights.map((h) => (
              <div
                key={`${h.annoId}-${Math.round(h.rect.left)}-${Math.round(h.rect.top)}`}
                className={cn("absolute", overlayClass(h.style, h.hasNote))}
                // Tọa độ hình chữ nhật được tính trong lúc chạy.
                style={{
                  left: h.rect.left,
                  top: h.rect.top,
                  width: h.rect.width,
                  height: h.rect.height,
                  ...(h.style.startsWith("#")
                    ? { backgroundColor: annotationColorRgba(h.style, 0.45) }
                    : {}),
                }}
              />
            ))}
            {searchMarks.map((mark) => (
              <div
                key={`search-${mark.ordinal}-${Math.round(mark.rect.top)}-${Math.round(mark.rect.left)}`}
                className={cn(
                  "absolute rounded-sm",
                  mark.ordinal === searchActiveOrdinal ? "bg-amber-400/65" : "bg-sky-300/40",
                )}
                style={{
                  left: mark.rect.left,
                  top: mark.rect.top,
                  width: mark.rect.width,
                  height: mark.rect.height,
                }}
              />
            ))}
            {citationMarks.map((mark) => (
              <div
                key={`citation-${mark.ordinal}-${Math.round(mark.rect.top)}-${Math.round(mark.rect.left)}`}
                className="absolute rounded-sm bg-emerald-400/50 ring-1 ring-emerald-600/60"
                style={{
                  left: mark.rect.left,
                  top: mark.rect.top,
                  width: mark.rect.width,
                  height: mark.rect.height,
                }}
              />
            ))}
          </div>
          {hoveredWord && (
            <div
              className="vocabulary-popover absolute z-20 max-h-48 w-72 max-w-[calc(100%-16px)] overflow-y-auto rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
              style={{
                left: Math.max(8, Math.min(hoveredWord.rect.left, cssWidth - 296)),
                top: Math.max(
                  8,
                  Math.min(hoveredWord.rect.top + hoveredWord.rect.height + 6, cssHeight - 210),
                ),
              }}
              role="tooltip"
              onMouseDown={(event) => event.stopPropagation()}
              onMouseEnter={() => setHoveredWord(hoveredWord)}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="break-words whitespace-pre-wrap">
                <strong>{hoveredWord.term}</strong>: {hoveredWord.meaning}
              </p>
              {editingOccurrence ? (
                <div className="mt-2 space-y-1.5">
                  <Textarea
                    autoFocus
                    value={occurrenceMeaning}
                    onChange={(event) => setOccurrenceMeaning(event.target.value)}
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("common.cancel", "Cancel")}
                      onClick={() => setEditingOccurrence(false)}
                    >
                      <X />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.saveOccurrenceMeaning", "Save this occurrence")}
                      disabled={occurrenceM.isPending || !occurrenceMeaning.trim()}
                      onClick={() =>
                        occurrenceM.mutate({
                          entryId: hoveredWord.entryId,
                          page: hoveredWord.page,
                          start: hoveredWord.start,
                          end: hoveredWord.end,
                          meaning: occurrenceMeaning,
                        })
                      }
                    >
                      <Check />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2"
                  onClick={() => {
                    setOccurrenceMeaning(hoveredWord.meaning);
                    setEditingOccurrence(true);
                  }}
                >
                  <Pencil /> {t("vocabulary.editOccurrenceMeaning", "Edit this occurrence")}
                </Button>
              )}
            </div>
          )}
          {/* data-page giúp nhận diện số trang tính từ 1; bộ lọc invert chỉ áp dụng lên canvas. */}
          <div ref={textLayerRef} data-page={index + 1} className="textLayer" />
          <div ref={annotationLayerRef} className="annotationLayer" />
          <div ref={autoLinkLayerRef} className="pdfAutoLinkLayer">
            {autoLinks.map((link) => (
              <a
                key={`${link.href}-${Math.round(link.rect.left)}-${Math.round(link.rect.top)}`}
                className="autoLinkAnnotation"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title={link.href}
                style={{
                  left: link.rect.left,
                  top: link.rect.top,
                  width: link.rect.width,
                  height: link.rect.height,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PdfAutoLink {
  href: string;
  rect: { left: number; top: number; width: number; height: number };
}

function buildPdfAutoLinks(
  textLayer: HTMLDivElement | null,
  annotationLayer: HTMLDivElement | null,
): PdfAutoLink[] {
  if (!textLayer || !annotationLayer) return [];
  const text = textLayer.textContent ?? "";
  const base = annotationLayer.getBoundingClientRect();
  const out: PdfAutoLink[] = [];
  for (const link of findPdfTextLinks(text)) {
    const range = rangeFromOffsets(textLayer, link.start, link.end);
    if (!range) continue;
    for (const rect of relativeRects(range.getClientRects(), base)) {
      out.push({ href: link.href, rect });
    }
  }
  return out;
}
