import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessagesSquare,
  Volume2,
} from "lucide-react";
import { qk } from "@renderer/query/keys";
import { Button } from "@renderer/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@renderer/components/ui/tooltip";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { usePdfTabsStore } from "@renderer/store/pdf-tabs-store";
import { useSettingsStore } from "@renderer/store/settings-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { usePaneSizeStore } from "@renderer/store/pane-size-store";
import { CollapsiblePane } from "@renderer/reader/CollapsiblePane";
import { SidebarReopenButton } from "@renderer/reader/SidebarReopenButton";
import { Sidebar, type PdfTocView } from "@renderer/reader/Sidebar";
import {
  ReaderToolsMenu,
  ReaderUtilityPanel,
  type ReaderPanelView,
  type ReaderToolView,
} from "@renderer/reader/ReaderPanel";
import {
  getReaderPanelOverlayCloseLabel,
  getReaderPanelRegionLabel,
} from "@renderer/reader/reader-panel-accessibility";
import { EpubReader } from "@renderer/reader/EpubReader";
import { PdfReader } from "@renderer/reader/PdfReader";
import type { PdfNavigationState } from "@renderer/reader/PdfThumbnailsPanel";
import { PdfTabsBar } from "@renderer/reader/PdfTabsBar";
import { ReaderPrefs } from "@renderer/reader/ReaderPrefs";
import { PdfPrefs } from "@renderer/reader/PdfPrefs";
import { SelectionToolbar } from "@renderer/reader/SelectionToolbar";
import { HighlightStyleBar } from "@renderer/reader/HighlightStyleBar";
import { NoteModal } from "@renderer/reader/NoteModal";
import { NoteHoverCard } from "@renderer/reader/NoteHoverCard";
import { AIPanel } from "@renderer/ai/AIPanel";
import { useRestoreConversation } from "@renderer/ai/use-restore-conversation";
import { useReadingClock } from "@renderer/reader/use-reading-clock";
import { openPanelAndFocusComposer } from "@renderer/ai/composer-focus";
import { TtsControlBar } from "@renderer/reader/TtsControlBar";
import { ttsController } from "@renderer/reader/tts/tts-controller";
import { useTtsStore } from "@renderer/store/tts-store";
import { EpubSessionProvider } from "@renderer/reader/epub-session";
import { PageStreakPill } from "@renderer/reading/PageStreakPill";
import { SettingsMenuButton } from "@renderer/shell/SettingsMenuButton";
import {
  hasRecentUserScrollIntent,
  isReadingScrollWheel,
  nextHeaderVisibility,
} from "@renderer/reader/header-visibility";

export function ReaderView({ mode }: { mode: "active" | "reference" }) {
  const { t } = useTranslation();
  const bookId = useNavigationStore((s) => s.currentBookId);
  useReadingClock(mode === "active" ? bookId : null);
  useRestoreConversation(bookId ? { kind: "book", bookId } : null);
  const chapterId = useNavigationStore((s) => s.currentChapterId);
  const backToLibrary = useNavigationStore((s) => s.backToLibrary);
  const readingPercent = useNavigationStore((s) => s.readingPercent);
  const readingContext = useNavigationStore((s) => s.readingContext);
  const showStats = useNavigationStore((s) => s.showStats);
  const openSettings = useSettingsStore((s) => s.setOpen);
  const layout = usePrefsStore((s) => s.layout);
  const updateLayout = usePrefsStore((s) => s.updateLayout);
  const sidebarWidth = usePaneSizeStore((s) => s.sidebarWidth);
  const setSidebarWidth = usePaneSizeStore((s) => s.setSidebarWidth);
  const panelWidth = usePaneSizeStore((s) => s.panelWidth);
  const setPanelWidth = usePaneSizeStore((s) => s.setPanelWidth);
  const ttsStatus = useTtsStore((s) => s.status);
  const [headerVisible, setHeaderVisible] = useState(true);
  const previousScrollTop = useRef<number | null>(null);
  const lastScrollIntentAt = useRef(0);
  const [pdfNavigation, setPdfNavigation] = useState<PdfNavigationState | null>(null);
  const [pdfTocView, setPdfTocView] = useState<PdfTocView>("contents");
  const [readerPanelView, setReaderPanelView] = useState<ReaderPanelView>("assistant");
  const handlePdfNavigationChange = useCallback((state: PdfNavigationState | null) => {
    setPdfNavigation(state);
  }, []);

  useEffect(() => {
    setPdfTocView("contents");
    setReaderPanelView("assistant");
    previousScrollTop.current = null;
    setHeaderVisible(true);
  }, [bookId]);

  useEffect(() => {
    const isReaderScrollTarget = (target: EventTarget | null) =>
      target instanceof Element && target.closest(".reader-scroll-region") != null;
    const noteScrollIntent = (event: Event) => {
      if (event instanceof WheelEvent && !isReadingScrollWheel(event)) return;
      if (!isReaderScrollTarget(event.target)) return;
      lastScrollIntentAt.current = performance.now();
      if (previousScrollTop.current == null && event.target instanceof Element) {
        const scrollRegion = event.target.closest<HTMLElement>(".reader-scroll-region");
        if (scrollRegion) previousScrollTop.current = scrollRegion.scrollTop;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (isReaderScrollTarget(event.target) || event.target === document.body) &&
        !(event.target instanceof HTMLElement && event.target.isContentEditable) &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)
      ) {
        lastScrollIntentAt.current = performance.now();
      }
    };
    const onReaderScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(".reader-scroll-region")) return;

      const currentScrollTop = target.scrollTop;
      // Bỏ qua lần cuộn đầu khi PDF/EPUB tự khôi phục vị trí đã đọc.
      if (previousScrollTop.current == null) {
        previousScrollTop.current = currentScrollTop;
        return;
      }
      // Chỉ ẩn/hiện theo cuộn do người dùng; việc bố cục hoặc khôi phục trang không tác động.
      if (!hasRecentUserScrollIntent(lastScrollIntentAt.current, performance.now())) {
        previousScrollTop.current = currentScrollTop;
        return;
      }
      const previousScrollTopValue = previousScrollTop.current;
      setHeaderVisible((visible) =>
        previousScrollTopValue == null
          ? visible
          : nextHeaderVisibility(visible, previousScrollTopValue, currentScrollTop),
      );
      previousScrollTop.current = currentScrollTop;
    };
    document.addEventListener("wheel", noteScrollIntent, true);
    document.addEventListener("touchstart", noteScrollIntent, true);
    document.addEventListener("touchmove", noteScrollIntent, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onReaderScroll, true);
    return () => {
      document.removeEventListener("wheel", noteScrollIntent, true);
      document.removeEventListener("touchstart", noteScrollIntent, true);
      document.removeEventListener("touchmove", noteScrollIntent, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onReaderScroll, true);
    };
  }, []);

  const chapters = useQuery({
    queryKey: qk.chapters(bookId ?? ""),
    queryFn: () => window.api.content.chapters({ bookId: bookId! }),
    enabled: bookId != null,
  });

  // Breadcrumb trên thanh đầu hiện tên sách; thanh bên chỉ giữ điều hướng đọc để tránh lặp.
  const book = useQuery({
    queryKey: qk.book(bookId ?? ""),
    queryFn: () => window.api.library.get({ bookId: bookId! }),
    enabled: bookId != null,
  });
  const pageStreak = useQuery({
    queryKey: qk.pageStreak,
    queryFn: () => window.api.stats.getPageStreak(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!bookId || book.data?.format !== "pdf") return;
    usePdfTabsStore.getState().register({ bookId, mode });
  }, [bookId, book.data?.format, mode]);

  if (!bookId) return null;

  const sidebarLabel = layout.sidebarOpen
    ? t("reader.collapseSidebar", "Thu gọn thanh bên")
    : t("reader.expandSidebar", "Mở rộng thanh bên");
  const assistantPanelSelected = layout.panelOpen && readerPanelView === "assistant";
  const panelLabel = assistantPanelSelected
    ? t("reader.collapseAiPanel", "Close AI assistant")
    : t("reader.expandAiPanel", "Open AI assistant");
  const overlayCloseLabel = getReaderPanelOverlayCloseLabel(readerPanelView);
  const panelRegionLabel = getReaderPanelRegionLabel(readerPanelView);
  // Breadcrumb gồm tên sách, chương và tiến độ; thiếu phần nào thì bỏ phần đó.
  // ePub hiện phần trăm; PDF thêm số trang từ readingContext, phần trăm lấy từ store riêng.
  const chapterTitle = chapters.data?.find((c) => c.id === chapterId)?.title ?? null;
  const progressLabel = (() => {
    if (readingPercent == null) return null;
    const pct = `${Math.round(readingPercent * 100)}%`;
    return readingContext?.format === "pdf" && readingContext.pageCount != null
      ? `${readingContext.page} / ${readingContext.pageCount} · ${pct}`
      : pct;
  })();
  const breadcrumb = [book.data?.title, chapterTitle, progressLabel].filter(Boolean).join(" · ");
  const openReaderTool = (view: ReaderToolView) => {
    setReaderPanelView(view);
    updateLayout({ panelOpen: true });
  };
  const toggleAssistantPanel = () => {
    if (layout.panelOpen && readerPanelView === "assistant") {
      updateLayout({ panelOpen: false });
      return;
    }
    setReaderPanelView("assistant");
    openPanelAndFocusComposer();
  };

  return (
    <div className="relative flex h-screen flex-col bg-background font-sans text-foreground">
      <div
        inert={!headerVisible}
        aria-hidden={!headerVisible}
        onPointerEnter={() => setHeaderVisible(true)}
        className={`z-[70] shrink-0 overflow-hidden transition-[height,opacity] duration-150 ease-out ${headerVisible ? "h-12 opacity-100" : "h-0 opacity-0"}`}
      >
        <header className="flex h-12 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={backToLibrary}
                    aria-label={t("reader.backToLibrary", "Library")}
                  />
                }
              >
                <ArrowLeft />
              </TooltipTrigger>
              <TooltipContent>{t("reader.backToLibrary", "Library")}</TooltipContent>
            </Tooltip>
            {breadcrumb && (
              <div className="ms-2 hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span className="size-1 shrink-0 rounded-full bg-border" />
                <span className="truncate">{breadcrumb}</span>
              </div>
            )}
            {pageStreak.data && <PageStreakPill streak={pageStreak.data} onClick={showStats} />}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {mode === "reference" && (
              <span className="px-2 text-xs text-muted-foreground">
                {t("reading.referenceMode", "Chế độ tham khảo")}
              </span>
            )}
            {!book.isPending && (book.data?.format === "pdf" ? <PdfPrefs /> : <ReaderPrefs />)}
            {!book.isPending && (
              <ReaderToolsMenu format={book.data?.format} onSelect={openReaderTool} />
            )}
            {!book.isPending && book.data?.format !== "pdf" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        ttsStatus === "idle"
                          ? void ttsController.playFromViewport()
                          : ttsController.stop()
                      }
                      aria-label={
                        ttsStatus === "idle"
                          ? t("reader.tts.start", "Đọc thành tiếng")
                          : t("reader.tts.stop", "Dừng")
                      }
                      className="text-muted-foreground"
                    />
                  }
                >
                  <Volume2 className={ttsStatus !== "idle" ? "text-primary" : undefined} />
                </TooltipTrigger>
                <TooltipContent>
                  {ttsStatus === "idle"
                    ? t("reader.tts.start", "Đọc thành tiếng")
                    : t("reader.tts.stop", "Dừng")}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleAssistantPanel}
                    aria-label={panelLabel}
                    aria-expanded={assistantPanelSelected}
                    className="text-muted-foreground"
                  />
                }
              >
                <MessagesSquare className={assistantPanelSelected ? "text-primary" : undefined} />
              </TooltipTrigger>
              <TooltipContent>{panelLabel}</TooltipContent>
            </Tooltip>
            <SettingsMenuButton
              documentFormat={book.data?.format ?? null}
              onOpenSettings={() => openSettings(true)}
            />
          </div>
        </header>
      </div>
      {!headerVisible && (
        <div
          aria-hidden="true"
          onPointerEnter={() => setHeaderVisible(true)}
          className="absolute inset-x-0 top-0 z-[71] h-6"
        />
      )}
      {book.data?.format === "pdf" && <PdfTabsBar currentBookId={bookId} />}
      {/* Cắt phần ngăn kéo được dịch ra ngoài khung để không tạo thanh cuộn ngang. */}
      <EpubSessionProvider bookId={bookId} enabled={book.data?.format === "epub"}>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <CollapsiblePane
            side="left"
            open={layout.sidebarOpen}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            label={sidebarLabel}
            peekOnHover={false}
            overlayOnSmallScreen
            onOverlayClose={() => updateLayout({ sidebarOpen: false })}
            overlayCloseLabel={t("reader.closeSidebarOverlay", "Close navigation sidebar")}
          >
            <div id="reader-navigation-sidebar" className="h-full min-h-0">
              <Sidebar
                bookId={bookId}
                format={book.data?.format}
                pdfNavigation={pdfNavigation}
                pdfTocView={pdfTocView}
                onPdfTocViewChange={setPdfTocView}
                onCollapseSidebar={() => updateLayout({ sidebarOpen: false })}
              />
            </div>
          </CollapsiblePane>
          <main className="relative min-w-0 flex-1">
            {/* Chọn trình đọc theo định dạng sau khi truy vấn sách sẵn sàng để không gắn nhầm EpubReader.
                EpubReader tự quản lý trạng thái tải, lỗi và khôi phục vị trí từ CFI. */}
            {book.isPending ? null : book.data?.format === "pdf" ? (
              <PdfReader
                bookId={bookId}
                chapters={chapters.data ?? []}
                persistProgress
                onNavigationChange={handlePdfNavigationChange}
              />
            ) : (
              <EpubReader
                bookId={bookId}
                chapters={chapters.data ?? []}
                persistProgress={mode === "active"}
              />
            )}
            <TtsControlBar />
          </main>
          <CollapsiblePane
            side="right"
            open={layout.panelOpen}
            width={panelWidth}
            onWidthChange={setPanelWidth}
            label={t(panelRegionLabel.key, panelRegionLabel.fallback)}
            peekOnHover={false}
            overlayOnSmallScreen
            onOverlayClose={() => updateLayout({ panelOpen: false })}
            overlayCloseLabel={t(overlayCloseLabel.key, overlayCloseLabel.fallback)}
          >
            <div
              className="h-full min-h-0 bg-background"
              hidden={!layout.panelOpen || readerPanelView !== "assistant"}
            >
              <AIPanel
                context={{ kind: "book", bookId }}
                onClose={() => updateLayout({ panelOpen: false })}
              />
            </div>
            {layout.panelOpen && readerPanelView !== "assistant" && (
              <ReaderUtilityPanel
                bookId={bookId}
                format={book.data?.format}
                view={readerPanelView}
                onClose={() => updateLayout({ panelOpen: false })}
              />
            )}
          </CollapsiblePane>
        </div>
      </EpubSessionProvider>
      {!layout.sidebarOpen && (
        <SidebarReopenButton
          label={sidebarLabel}
          onOpen={() => updateLayout({ sidebarOpen: true })}
        />
      )}
      <SelectionToolbar />
      <HighlightStyleBar />
      <NoteModal />
      <NoteHoverCard />
    </div>
  );
}
