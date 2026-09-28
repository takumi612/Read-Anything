import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { SectionFrame, type SectionSelectEvent } from "./SectionFrame";
import type { ViewportRect } from "./geometry";
import {
  calibratedEstimate,
  deferBeforeLoadedIndex,
  sectionScrollRatio,
  sectionsToUnload,
  topVisibleSection,
} from "./precision";
import {
  initialViewportState,
  overscanTop,
  reduceViewport,
  type AlignResult,
  type ViewportEffect,
  type ViewportEvent,
} from "./viewport-machine";
import { useMachine, type TransitionRecord } from "./use-machine";

/** Chiều cao placeholder mặc định cho section chưa có cache; dùng số đo thật khi cache có dữ liệu. */
const DEFAULT_ESTIMATE = 600;
/** Số section giữ lại ở mỗi phía của active range; phần vượt quá sẽ được gỡ tải. */
const KEEP_DISTANCE = 5;
/**
 * Khoảng đệm (px) để gắn trước section ngoài viewport, đối xứng hai phía. Việc này giúp:
 * ① section phía trên được gắn và đo trước khi cuộn tới, tránh phải bù scrollTop nhiều;
 * ② section theo hướng cuộn được tải sớm để nội dung sẵn sàng khi vào viewport.
 * Thử nghiệm cho thấy 2400px là điểm phù hợp; tăng thêm chỉ làm tăng số iframe đồng thời.
 */
const OVERSCAN_PX = { top: 2400, bottom: 2400 };
/** Khoảng thời gian giữa các lần thử căn chỉnh (ms). */
const ALIGN_TICK_MS = 100;

export interface VirtualDocsHandle {
  /** Cuộn đến đầu section tại index, không thử căn chỉnh lại. */
  scrollToIndex: (index: number) => void;
  /** Cuộn đến phần tử có id===anchorId trong section tại index. */
  scrollToAnchor: (index: number, anchorId: string) => Promise<AlignResult>;
  /**
   * Cuộn đến phần tử resolveEl(doc) tìm thấy trong section tại index; doc là tài liệu iframe.
   * Nếu trả về null, phần tử chưa sẵn sàng và sẽ được thử lại. Virtuoso cần đo chiều cao thật
   * trước khi áp dụng offset lớn. Promise luôn hoàn tất khi căn chỉnh thành công, hết giờ hoặc bị hủy.
   * owner phân biệt nguồn gọi: restore không tính là điều hướng người dùng, còn user thì có.
   */
  scrollToSectionElement: (
    index: number,
    resolveEl: (doc: Document) => Element | null,
    opts: { owner: "restore" | "user" },
  ) => Promise<AlignResult>;
  /** Chạy lại decorate cho các section đang gắn, ví dụ sau khi sửa chú thích. */
  redecorate: () => void;
  /** Phần tử cuộn thực tế, dùng để tính hình học viewport mà không phụ thuộc selector toàn cục. */
  getScrollerElement: () => HTMLElement | null;
}

export interface VirtualDocsProps {
  count: number;
  /**
    * Tải bất đồng bộ HTML đã phân giải tài nguyên cho section theo chỉ số.
    * Callback phải ổn định (dùng useCallback), vì đổi tham chiếu sẽ tải lại mọi section đang gắn.
   */
  loadSection: (index: number) => Promise<string>;
  styleCss?: string;
  initialIndex?: number;
  /**
    * Kích thước tương đối của section (chẳng hạn số ký tự), dùng để ước tính chiều cao
    * section chưa đo theo tỷ lệ px/trọng số đã đo. Nếu bỏ qua, dùng mặc định 600px;
    * chênh lệch lớn có thể gây giật khi đo lần đầu lúc cuộn lên. Callback phải ổn định.
   */
  sectionWeight?: (index: number) => number;
  /**
    * Ước tính px/trọng số tối thiểu trước khi có section đo thực tế; phù hợp với trọng số
    * có đơn vị ổn định như số ký tự. Chỉ dùng lúc khởi động, sau đó được hiệu chỉnh bằng số đo.
   */
  initialPxPerWeight?: number;
  /**
   * Gọi lại khi section ở đầu viewport thay đổi. Ưu tiên IntersectionObserver;
   * nếu không hỗ trợ, dùng rangeChanged.startIndex của Virtuoso (xấp xỉ, gồm overscan).
   */
  onTopSectionChange?: (index: number, meta: { scrollRatio: number }) => void;
  onSelect?: (e: SectionSelectEvent) => void;
  onSelectionCleared?: () => void;
  decorate?: (index: number, doc: Document) => void;
  onHighlightClick?: (annoId: string, rect: ViewportRect) => void;
  onHighlightHover?: (annoId: string, rect: ViewportRect) => void;
  onHighlightLeave?: () => void;
  onContentMouseDown?: () => void;
  /** Gọi khi người dùng thao tác vùng cuộn để bên dùng có thể hủy khôi phục vị trí đang chờ. */
  onUserNavigation?: () => void;
  /** Gọi khi click liên kết nội bộ trong iframe để chuyển đến section và anchor tương ứng. */
  onInternalLink?: (e: { index: number; href: string }) => void;
  /** Gọi khi click liên kết ngoài trong iframe để mở bằng trình duyệt hệ thống. */
  onExternalLink?: (url: string) => void;
  /** Gọi một lần khi section ra khỏi active range ± KEEP_DISTANCE để bên dùng giải phóng tài nguyên. */
  onUnloadSection?: (index: number) => void;
  /** className chuyển tiếp đến phần tử cuộn gốc của Virtuoso, chẳng hạn để ẩn thanh cuộn. */
  className?: string;
  /** Bản ghi chẩn đoán mỗi lần trạng thái viewport đổi; bên dùng chuyển tiếp đến logger của họ. */
  onTransition?: (record: TransitionRecord) => void;
}

export const VirtualDocs = forwardRef<VirtualDocsHandle, VirtualDocsProps>(function VirtualDocs(
  {
    count,
    loadSection,
    styleCss,
    initialIndex,
    sectionWeight,
    initialPxPerWeight,
    onTopSectionChange,
    onSelect,
    onSelectionCleared,
    decorate,
    onHighlightClick,
    onHighlightHover,
    onHighlightLeave,
    onContentMouseDown,
    onUserNavigation,
    onInternalLink,
    onExternalLink,
    onUnloadSection,
    className,
    onTransition,
  },
  ref,
) {
  const vRef = useRef<VirtuosoHandle | null>(null);
  const scrollerEl = useRef<HTMLElement | null>(null);
  /** Timer căn chỉnh và hàm tìm phần tử đích của mỗi lượt định vị. */
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveElRef = useRef<((doc: Document) => Element | null) | null>(null);
  const alignTargetRef = useRef<number | null>(null);
  /**
   * Hàng đợi FIFO các hàm hoàn tất Promise của scrollToSectionElement. Cần dùng hàng đợi
   * thay vì một ref: ALIGN_REQUESTED mới hủy Promise của lượt trước, nhưng effect chạy sau commit;
   * khi đó resolve của lượt mới đã được ghi, nên một ref sẽ hoàn tất nhầm Promise mới và bỏ treo Promise cũ.
   */
  const alignResolversRef = useRef<((result: AlignResult) => void)[]>([]);
  /** Ticker cần gọi raise trước khi useMachine khởi tạo; khai báo ref trước rồi gán sau. */
  const raiseRef = useRef<((event: ViewportEvent) => void) | null>(null);
  const onUserNavigationRef = useRef(onUserNavigation);
  onUserNavigationRef.current = onUserNavigation;
  const [decorateNonce, setDecorateNonce] = useState(0);
  const [scrollerReady, setScrollerReady] = useState(0);

  const heightCache = useRef<Map<number, number>>(new Map());
  // Các section đã gỡ tải: tránh gỡ lặp; xóa khỏi tập khi section trở lại vùng giữ để tải lại.
  const unloaded = useRef<Set<number>>(new Set());
  const observedEls = useRef<Map<number, HTMLElement>>(new Map());
  const io = useRef<IntersectionObserver | null>(null);
  const lastTop = useRef<number | null>(null);

  // Đo rect của mọi section đã đăng ký, chọn section ở đầu viewport bằng hàm thuần rồi báo kết quả.
  // force=true bỏ qua khử trùng lặp theo chỉ số: cuộn giữa các anchor trong cùng section vẫn cập nhật
  // scrollRatio để bên dùng theo dõi chương và tiến độ theo anchor (IO chỉ chạy ở ranh giới section).
  const recomputeTop = (force = false) => {
    const scroller = scrollerEl.current;
    if (!scroller) return;
    const vt = scroller.getBoundingClientRect().top;
    const secs = [...observedEls.current.entries()].map(([index, el]) => {
      const r = el.getBoundingClientRect();
      return { index, top: r.top, bottom: r.bottom };
    });
    const section = topVisibleSection(secs, vt);
    if (section) raise({ type: "VISIBLE_TOP_CHANGED", index: section.index });
    if (section && (section.index !== lastTop.current || force)) {
      lastTop.current = section.index;
      onTopSectionChange?.(section.index, { scrollRatio: sectionScrollRatio(section, vt) });
    }
  };
  // IO callback giữ recomputeTop tại thời điểm tạo. Ref cập nhật giúp callback luôn gọi closure mới,
  // kể cả khi onTopSectionChange đổi tham chiếu, tránh dữ liệu cũ.
  const recomputeRef = useRef(recomputeTop);
  recomputeRef.current = recomputeTop;

  /** Đo độ lệch phần tử đích so với đầu vùng cuộn để gửi trong ALIGN_TICK; reducer không truy cập DOM. */
  const measureAlignment = useCallback((): { aligned: boolean; offset: number | null } => {
    const index = alignTargetRef.current;
    const resolveEl = resolveElRef.current;
    const scroller = scrollerEl.current;
    if (index == null || !resolveEl || !scroller) return { aligned: false, offset: null };
    const frame = scroller.querySelector<HTMLIFrameElement>(
      `[data-section-index="${index}"] iframe`,
    );
    const doc = frame?.contentDocument;
    const docRoot = doc?.documentElement;
    const el = doc && docRoot && docRoot.scrollHeight > 0 ? resolveEl(doc) : null;
    if (!el || !docRoot || !frame) return { aligned: false, offset: null };
    const offset = el.getBoundingClientRect().top - docRoot.getBoundingClientRect().top;
    const delta = frame.getBoundingClientRect().top + offset - scroller.getBoundingClientRect().top;
    return { aligned: Math.abs(delta) <= 4, offset };
  }, []);

  const runViewportEffect = (effect: ViewportEffect) => {
    switch (effect.kind) {
      case "scrollToIndex":
        vRef.current?.scrollToIndex({
          index: effect.index,
          align: "start",
          ...(effect.offset == null ? {} : { offset: effect.offset }),
        });
        return;
      case "startTicker": {
        if (tickerRef.current) clearInterval(tickerRef.current);
        const runId = effect.runId;
        tickerRef.current = setInterval(() => {
          const { aligned, offset } = measureAlignment();
          raiseRef.current?.({ type: "ALIGN_TICK", runId, aligned, offset });
        }, ALIGN_TICK_MS);
        return;
      }
      case "stopTicker":
        // Chỉ dừng timer, không xóa alignTargetRef/resolveElRef. ALIGN_REQUESTED mới ghi mục tiêu
        // trước khi raise, còn effect stopTicker chạy sau commit. Xóa ở đây sẽ mất mục tiêu mới;
        // measureAlignment luôn báo chưa căn chỉnh và kéo viewport về đầu section trong 30 giây.
        // ALIGN_REQUESTED tiếp theo sẽ ghi đè các ref này nên không cần dọn.
        if (tickerRef.current) clearInterval(tickerRef.current);
        tickerRef.current = null;
        return;
      case "reportAlignResult":
        // Lấy phần tử đầu hàng đợi FIFO: "cancelled" từ ALIGN_REQUESTED mới hoàn tất Promise cũ,
        // còn resolve của lượt mới đang ở cuối hàng. Dùng một ref sẽ hủy nhầm Promise mới và bỏ treo Promise cũ.
        alignResolversRef.current.shift()?.(effect.result);
        return;
      case "recomputeTop":
        recomputeRef.current(true);
        return;
    }
  };

  const [viewport, raise] = useMachine(
    reduceViewport,
    initialViewportState(initialIndex ?? 0),
    runViewportEffect,
    {
      describeState: (s) => s.phase.kind,
      onTransition,
    },
  );
  raiseRef.current = raise;

  useImperativeHandle(ref, () => {
    // Cuộn đến phần tử resolveEl(doc) tìm thấy trong section tại index. Trước tiên dùng scrollToIndex
    // để đưa section vào vùng render và tải iframe, sau đó căn chỉnh lại theo độ lệch thực tế.
    // Chỉ dựa vào scrollHeight không đủ xác nhận đã đo xong: section dài phía trước có thể đổi chiều cao muộn.
    // Hết tối đa 30 giây thì giữ vị trí cuối cùng để tránh treo hoặc màn hình trắng.
    const scrollToSectionElement = (
      index: number,
      resolveEl: (doc: Document) => Element | null,
      opts: { owner: "restore" | "user" },
    ): Promise<AlignResult> => {
      alignTargetRef.current = index;
      resolveElRef.current = resolveEl;
      return new Promise<AlignResult>((resolve) => {
        // Thêm resolve vào hàng đợi trước raise: effect "cancelled" sẽ lấy resolve cũ ở đầu hàng;
        // mỗi lượt hoàn tất đúng Promise của mình.
        alignResolversRef.current.push(resolve);
        raise({ type: "ALIGN_REQUESTED", index, owner: opts.owner });
      });
    };
    return {
      scrollToIndex: (index: number) => raise({ type: "JUMP_REQUESTED", index }),
      scrollToAnchor: (index: number, anchorId: string) =>
        scrollToSectionElement(index, (doc) => doc.getElementById(anchorId), { owner: "user" }),
      scrollToSectionElement,
      redecorate: () => setDecorateNonce((n) => n + 1),
      getScrollerElement: () => scrollerEl.current,
    };
  }, [raise]);

  const ioSupported = typeof IntersectionObserver !== "undefined";

  // Gói virtual-docs không chạy qua React Compiler (renderer có chạy; Babel loại node_modules mặc định),
  // nên callback truyền cho Virtuoso và component con phải được ổn định bằng useCallback.
  // LazySection đăng ký/hủy đăng ký khi mount/unmount; callback đổi mỗi lần render sẽ chạy lại effect.
  const registerSection = useCallback((index: number, el: HTMLElement) => {
    observedEls.current.set(index, el);
    io.current?.observe(el);
  }, []);
  const unregisterSection = useCallback((index: number, el: HTMLElement) => {
    observedEls.current.delete(index);
    io.current?.unobserve(el);
  }, []);
  // Giữ scrollerRef ổn định: Virtuoso dùng nó làm callback ref; hàm inline đổi mỗi lần render
  // sẽ gây detach/attach, setScrollerReady, render lại và lặp vô hạn.
  const handleScrollerRef = useCallback((el: HTMLElement | null | Window) => {
    scrollerEl.current = el instanceof HTMLElement ? el : null;
    setScrollerReady((n) => n + 1);
  }, []);
  const handleUserNavigation = useCallback(() => {
    raise({ type: "USER_INPUT", scrollIntent: false });
    onUserNavigationRef.current?.();
  }, [raise]);
  const handleUserScrollNavigation = useCallback(() => {
    raise({ type: "USER_INPUT", scrollIntent: true });
    onUserNavigationRef.current?.();
  }, [raise]);

  // A new imperative command cancels the previous one above; genuine user input also owns the
  // viewport from that point onward, so stale restoration retries must not pull it back.
  useEffect(() => {
    const scroller = scrollerEl.current;
    if (!scroller) return;
    const scrollEvents = ["wheel", "touchstart", "keydown"] as const;
    for (const event of scrollEvents) scroller.addEventListener(event, handleUserScrollNavigation);
    scroller.addEventListener("pointerdown", handleUserNavigation);
    return () => {
      for (const event of scrollEvents)
        scroller.removeEventListener(event, handleUserScrollNavigation);
      scroller.removeEventListener("pointerdown", handleUserNavigation);
    };
  }, [scrollerReady, handleUserNavigation, handleUserScrollNavigation]);

  useEffect(
    () => () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      tickerRef.current = null;
      // Hoàn tất mọi Promise đang chờ khi unmount hoặc đổi sách để tiến trình khôi phục không bị treo.
      const pending = alignResolversRef.current;
      alignResolversRef.current = [];
      for (const resolve of pending) resolve("cancelled");
    },
    [],
  );

  // Khi vùng cuộn sẵn sàng, tạo IO để theo dõi phần tử đã đăng ký và throttle sự kiện cuộn.
  useEffect(() => {
    const scroller = scrollerEl.current;
    if (!scroller) return;
    const obs = ioSupported
      ? new IntersectionObserver(() => recomputeRef.current(), { root: scroller })
      : null;
    io.current = obs;
    if (obs) {
      for (const el of observedEls.current.values()) obs.observe(el);
    }
    // IO chỉ chạy ở ranh giới section. Với section chứa nhiều chương theo anchor, cần tính lại section
    // đầu viewport khi cuộn bên trong bằng scrollRatio hiện tại. Throttle đầu/cuối hạn chế xử lý mỗi frame.
    const THROTTLE_MS = 120;
    let lastRun = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const elapsed = performance.now() - lastRun;
      if (elapsed >= THROTTLE_MS) {
        lastRun = performance.now();
        recomputeRef.current(true);
      } else if (!trailing) {
        // Chạy thêm một lần ở cuối để cập nhật vị trí cuối cùng sau khi cuộn dừng trong cửa sổ throttle.
        trailing = setTimeout(() => {
          trailing = undefined;
          lastRun = performance.now();
          recomputeRef.current(true);
        }, THROTTLE_MS - elapsed);
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      obs?.disconnect();
      io.current = null;
      scroller.removeEventListener("scroll", onScroll);
      if (trailing) clearTimeout(trailing);
    };
    // scrollerReady làm mới effect khi scrollerRef sẵn sàng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollerReady, ioSupported]);

  // styleCss đổi (tùy chọn bố cục/chủ đề) có thể đổi chiều cao mọi section nên xóa toàn bộ cache.
  useEffect(() => {
    heightCache.current.clear();
  }, [styleCss]);

  // Ổn định itemContent bằng useCallback để Virtuoso không render lại mọi hàng đang gắn.
  const onMeasured = useCallback((i: number, h: number) => {
    heightCache.current.set(i, h);
  }, []);
  const itemContent = useCallback(
    (index: number) => (
      <LazySection
        index={index}
        deferLoad={deferBeforeLoadedIndex(viewport.loadedFromIndex, index)}
        loadSection={loadSection}
        styleCss={styleCss}
        onSelect={onSelect}
        onSelectionCleared={onSelectionCleared}
        decorate={decorate}
        onHighlightClick={onHighlightClick}
        onHighlightHover={onHighlightHover}
        onHighlightLeave={onHighlightLeave}
        decorateNonce={decorateNonce}
        onContentMouseDown={onContentMouseDown}
        onUserNavigation={handleUserNavigation}
        onUserScrollNavigation={handleUserScrollNavigation}
        onInternalLink={onInternalLink}
        onExternalLink={onExternalLink}
        estimatedHeight={calibratedEstimate(
          heightCache.current,
          sectionWeight,
          index,
          DEFAULT_ESTIMATE,
          initialPxPerWeight,
        )}
        onMeasured={onMeasured}
        registerSection={registerSection}
        unregisterSection={unregisterSection}
      />
    ),
    [
      loadSection,
      initialIndex,
      viewport.loadedFromIndex,
      styleCss,
      sectionWeight,
      initialPxPerWeight,
      onSelect,
      onSelectionCleared,
      decorate,
      onHighlightClick,
      onHighlightHover,
      onHighlightLeave,
      decorateNonce,
      onContentMouseDown,
      handleUserNavigation,
      handleUserScrollNavigation,
      onInternalLink,
      onExternalLink,
      onMeasured,
      registerSection,
      unregisterSection,
    ],
  );

  return (
    <Virtuoso
      ref={vRef}
      className={className}
      style={{ height: "100%" }}
      totalCount={count}
      initialTopMostItemIndex={initialIndex ?? 0}
      increaseViewportBy={{
        top: overscanTop(viewport, initialIndex ?? 0, OVERSCAN_PX.top),
        bottom: OVERSCAN_PX.bottom,
      }}
      itemContent={itemContent}
      scrollerRef={handleScrollerRef}
      rangeChanged={(range) => {
        if (!ioSupported) onTopSectionChange?.(range.startIndex, { scrollRatio: 0 }); // Dự phòng xấp xỉ khi không có IO.
        const lo = Math.max(0, range.startIndex - KEEP_DISTANCE);
        const hi = Math.min(count - 1, range.endIndex + KEEP_DISTANCE);
        for (let i = lo; i <= hi; i++) unloaded.current.delete(i);
        for (const i of sectionsToUnload(range, count, KEEP_DISTANCE)) {
          if (!unloaded.current.has(i)) {
            unloaded.current.add(i);
            onUnloadSection?.(i);
          }
        }
      }}
    />
  );
});

function LazySection({
  index,
  deferLoad,
  loadSection,
  styleCss,
  onSelect,
  onSelectionCleared,
  decorate,
  onHighlightClick,
  onHighlightHover,
  onHighlightLeave,
  decorateNonce,
  onContentMouseDown,
  onUserNavigation,
  onUserScrollNavigation,
  onInternalLink,
  onExternalLink,
  estimatedHeight,
  onMeasured,
  registerSection,
  unregisterSection,
}: {
  index: number;
  deferLoad: boolean;
  loadSection: (index: number) => Promise<string>;
  styleCss?: string;
  onSelect?: (e: SectionSelectEvent) => void;
  onSelectionCleared?: () => void;
  decorate?: (index: number, doc: Document) => void;
  onHighlightClick?: (annoId: string, rect: ViewportRect) => void;
  onHighlightHover?: (annoId: string, rect: ViewportRect) => void;
  onHighlightLeave?: () => void;
  decorateNonce?: number;
  onContentMouseDown?: () => void;
  onUserNavigation?: () => void;
  onUserScrollNavigation?: () => void;
  onInternalLink?: (e: { index: number; href: string }) => void;
  onExternalLink?: (url: string) => void;
  estimatedHeight?: number;
  onMeasured?: (index: number, height: number) => void;
  registerSection: (index: number, el: HTMLElement) => void;
  unregisterSection: (index: number, el: HTMLElement) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (deferLoad) {
      setHtml(null);
      return;
    }
    let alive = true;
    loadSection(index)
      .then((h) => alive && setHtml(h))
      .catch((err) => {
        console.error("[virtual-docs] section load failed", index, err);
        if (alive) setHtml("<p>Không thể tải nội dung phần này.</p>");
      });
    return () => {
      alive = false;
    };
  }, [index, loadSection, deferLoad]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    registerSection(index, el);
    return () => unregisterSection(index, el);
  }, [index, registerSection, unregisterSection]);

  return (
    <div ref={outerRef} data-section-index={index}>
      {html == null ? (
        <div style={{ height: estimatedHeight ?? 200 }} />
      ) : (
        <SectionFrame
          index={index}
          html={html}
          styleCss={styleCss}
          onSelect={onSelect}
          onSelectionCleared={onSelectionCleared}
          decorate={decorate}
          onHighlightClick={onHighlightClick}
          onHighlightHover={onHighlightHover}
          onHighlightLeave={onHighlightLeave}
          decorateNonce={decorateNonce}
          onContentMouseDown={onContentMouseDown}
          onUserNavigation={onUserNavigation}
          onUserScrollNavigation={onUserScrollNavigation}
          onInternalLink={onInternalLink}
          onExternalLink={onExternalLink}
          estimatedHeight={estimatedHeight}
          onMeasured={onMeasured}
        />
      )}
    </div>
  );
}
