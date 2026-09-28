import { useEffect, useMemo, useRef } from "react";
import { toViewportRect, type ViewportRect } from "./geometry";
import { classifyLink } from "./link-target";

export interface SectionSelectEvent {
  index: number;
  range: Range;
  doc: Document;
  rect: ViewportRect;
  text: string;
}

interface Props {
  index: number;
  html: string;
  styleCss?: string;
  onSelect?: (e: SectionSelectEvent) => void;
  onSelectionCleared?: () => void;
  /** Gọi sau khi iframe tải xong hoặc decorateNonce đổi để vẽ lại dấu highlight. */
  decorate?: (index: number, doc: Document) => void;
  /** Gọi khi click phần tử có data-anno-id; rect tính theo viewport. */
  onHighlightClick?: (annoId: string, rect: ViewportRect) => void;
  /** Gọi khi hover highlight có ghi chú; rect tính theo viewport. */
  onHighlightHover?: (annoId: string, rect: ViewportRect) => void;
  /** Gọi khi rời highlight có ghi chú hoặc rời iframe. */
  onHighlightLeave?: () => void;
  /** Tăng giá trị để trang đã tải chạy lại decorate sau khi annotation đổi. */
  decorateNonce?: number;
  /** Báo mousedown trong iframe để bên dùng đóng popup ở tài liệu cha. */
  onContentMouseDown?: () => void;
  /** Báo thao tác pointer trong iframe vì container cha không nhận sự kiện xuyên tài liệu. */
  onUserNavigation?: () => void;
  /** Báo input làm thay đổi vị trí đọc để dần mở các section phía trước. */
  onUserScrollNavigation?: () => void;
  /** Báo click liên kết nội bộ để bên dùng chuyển sang section và anchor tương ứng. */
  onInternalLink?: (e: { index: number; href: string }) => void;
  /** Báo click liên kết ngoài để mở bằng trình duyệt hệ thống. */
  onExternalLink?: (url: string) => void;
  /** Chiều cao tạm từ cache trước khi nội dung sẵn sàng, tránh nhảy bố cục. */
  estimatedHeight?: number;
  /** Báo chiều cao thật sau khi đo ổn định để VirtualDocs cập nhật cache. */
  onMeasured?: (index: number, height: number) => void;
}

const STYLE_ID = "vd-style";

/** Thời gian tối đa chờ ảnh và font; hết hạn dùng chiều cao hiện tại. */
const READY_TIMEOUT_MS = 2000;
/** Khoảng debounce khi đo lại sau thay đổi nội dung hoặc cỡ chữ. */
const RO_DEBOUNCE_MS = 100;

/** Bọc HTML đoạn hoặc trang đầy đủ thành tài liệu có CSS cần thiết. */
function buildSrcDoc(html: string, styleCss?: string): string {
  const style = `<style id="${STYLE_ID}">${styleCss ?? ""}</style>`;
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${style}`);
  return `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${html}</body></html>`;
}

export function SectionFrame({
  index,
  html,
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
  estimatedHeight,
  onMeasured,
  onInternalLink,
  onExternalLink,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Giữ callback mới nhất trong ref để không gắn lại effect mỗi lần render.
  const cbRef = useRef({
    onSelect,
    onSelectionCleared,
    decorate,
    onHighlightClick,
    onHighlightHover,
    onHighlightLeave,
    onContentMouseDown,
    onUserNavigation,
    onUserScrollNavigation,
    estimatedHeight,
    onMeasured,
    onInternalLink,
    onExternalLink,
  });
  cbRef.current = {
    onSelect,
    onSelectionCleared,
    decorate,
    onHighlightClick,
    onHighlightHover,
    onHighlightLeave,
    onContentMouseDown,
    onUserNavigation,
    onUserScrollNavigation,
    estimatedHeight,
    onMeasured,
    onInternalLink,
    onExternalLink,
  };
  const docRef = useRef<Document | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let ro: ResizeObserver | undefined;
    let roTimer: ReturnType<typeof setTimeout> | undefined;
    let readyTimeout: ReturnType<typeof setTimeout> | undefined;
    let doc: Document | null = null;

    const onMouseUp = () => {
      if (!doc) return;
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const text = sel.toString().trim();
      if (!text) return;
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      const fr = iframe.getBoundingClientRect();
      cbRef.current.onSelect?.({ index, range, doc, rect: toViewportRect(r, fr), text });
    };
    const onSelChange = () => {
      if (!doc) return;
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed) cbRef.current.onSelectionCleared?.();
    };
    const onAnnoClick = (e: MouseEvent) => {
      if (!doc) return;
      const el = (e.target as Element | null)?.closest?.("[data-anno-id]") as HTMLElement | null;
      if (!el) return;
      const id = el.getAttribute("data-anno-id");
      if (!id) return;
      const r = el.getBoundingClientRect();
      const fr = iframe.getBoundingClientRect();
      cbRef.current.onHighlightClick?.(id, toViewportRect(r, fr));
    };
    // Kiểm tra điểm theo viewport iframe có nằm trong vùng chọn hiện tại không.
    const pointInSelection = (x: number, y: number): boolean => {
      if (!doc) return false;
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
      try {
        const caret = (
          doc as Document & { caretRangeFromPoint?(x: number, y: number): Range | null }
        ).caretRangeFromPoint?.(x, y);
        return !!caret && sel.getRangeAt(0).isPointInRange(caret.startContainer, caret.startOffset);
      } catch {
        return false;
      }
    };
    const onContentDown = (e: MouseEvent) => {
      // Click trong vùng chọn: ngăn trình duyệt thu hẹp vùng chọn, để mouseup mở lại toolbar.
      // Click ngoài vùng chọn được báo như bình thường để đóng popup.
      if (pointInSelection(e.clientX, e.clientY)) {
        e.preventDefault();
        return;
      }
      cbRef.current.onContentMouseDown?.();
    };
    const onUserNavigationInput = () => cbRef.current.onUserNavigation?.();
    const onUserScrollNavigationInput = () => cbRef.current.onUserScrollNavigation?.();
    // Chỉ báo khi ID highlight có ghi chú thay đổi để giảm cập nhật store.
    let lastNotedId: string | null = null;
    const reportLeaveIfNeeded = () => {
      if (lastNotedId !== null) {
        lastNotedId = null;
        cbRef.current.onHighlightLeave?.();
      }
    };
    // Hover vùng chọn đổi con trỏ; hover/leave highlight có ghi chú được báo lên.
    const onContentMove = (e: MouseEvent) => {
      if (!doc?.body) return;
      const cursor = pointInSelection(e.clientX, e.clientY) ? "pointer" : "";
      if (doc.body.style.cursor !== cursor) doc.body.style.cursor = cursor;
      const mark = (e.target as Element | null)?.closest?.("mark.anno-noted") as HTMLElement | null;
      const id = mark?.getAttribute("data-anno-id") ?? null;
      if (id === lastNotedId) return;
      lastNotedId = id;
      if (id && mark) {
        const r = mark.getBoundingClientRect();
        const fr = iframe.getBoundingClientRect();
        cbRef.current.onHighlightHover?.(id, toViewportRect(r, fr));
      } else {
        cbRef.current.onHighlightLeave?.();
      }
    };
    // Rời iframe thì bắt đầu đóng thẻ ghi chú; vào thẻ sẽ hủy thao tác đóng.
    const onContentOut = (e: MouseEvent) => {
      // relatedTarget null nghĩa là đã ra ngoài tài liệu iframe.
      if (e.relatedTarget === null) reportLeaveIfNeeded();
    };
    const onLinkClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      // Dùng thuộc tính href gốc; a.href có thể bị about:srcdoc biến thành URL sai.
      const raw = a.getAttribute("href") ?? "";
      const target = classifyLink(raw);
      if (!target) {
        e.preventDefault(); // Liên kết "#" chỉ cần chặn điều hướng mặc định.
        return;
      }
      e.preventDefault(); // Chặn iframe tự điều hướng gây trang trắng.
      if (target.type === "external") cbRef.current.onExternalLink?.(target.url);
      else cbRef.current.onInternalLink?.({ index, href: target.href });
    };
    const detach = () => {
      ro?.disconnect();
      ro = undefined;
      // Dọn timer đo chiều cao khi Virtuoso tái sử dụng DOM để không ghi kích thước sai.
      if (roTimer) {
        clearTimeout(roTimer);
        roTimer = undefined;
      }
      if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = undefined;
      }
      doc?.removeEventListener("mouseup", onMouseUp);
      doc?.removeEventListener("selectionchange", onSelChange);
      doc?.removeEventListener("click", onAnnoClick);
      doc?.removeEventListener("click", onLinkClick);
      doc?.removeEventListener("mousedown", onContentDown);
      doc?.removeEventListener("wheel", onUserScrollNavigationInput);
      doc?.removeEventListener("touchstart", onUserScrollNavigationInput);
      doc?.removeEventListener("pointerdown", onUserNavigationInput);
      doc?.removeEventListener("keydown", onUserScrollNavigationInput);
      doc?.removeEventListener("mousemove", onContentMove);
      doc?.removeEventListener("mouseout", onContentOut);
      if (doc?.body) doc.body.style.cursor = "";
      reportLeaveIfNeeded();
      doc = null;
      docRef.current = null;
    };
    const onLoad = () => {
      detach();
      doc = iframe.contentDocument;
      if (!doc) return;
      const d = doc; // Giữ tài liệu đã được kiểm tra cho closure.
      // Dùng chiều cao ước tính trước khi sẵn sàng, thay vì chiều cao mặc định của iframe.
      iframe.style.height = `${cbRef.current.estimatedHeight ?? 0}px`;

      const measure = () => {
        iframe.style.height = `${d.documentElement.scrollHeight}px`;
      };
      let settled = false;
      const reportStable = () => {
        if (settled) return;
        settled = true;
        const h = d.documentElement.scrollHeight;
        iframe.style.height = `${h}px`;
        cbRef.current.onMeasured?.(index, h);
        // Gắn ResizeObserver sau khi sẵn sàng để đo lại khi nội dung/cỡ chữ đổi.
        ro = new ResizeObserver(() => {
          if (roTimer) clearTimeout(roTimer);
          roTimer = setTimeout(measure, RO_DEBOUNCE_MS);
        });
        ro.observe(d.documentElement);
      };

      // Chờ ảnh giải mã và font sẵn sàng; timeout ngăn chờ vô hạn.
      const imgs = Array.from(d.images);
      const ready = Promise.all([
        ...imgs.map((img) => img.decode().catch(() => undefined)),
        d.fonts?.ready ?? Promise.resolve(),
      ]).then(() => undefined);
      const timeout = new Promise<void>((res) => {
        readyTimeout = setTimeout(res, READY_TIMEOUT_MS);
      });
      void Promise.race([ready, timeout]).then(reportStable);

      doc.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("selectionchange", onSelChange);
      docRef.current = doc;
      cbRef.current.decorate?.(index, doc);
      doc.addEventListener("click", onAnnoClick);
      doc.addEventListener("click", onLinkClick);
      doc.addEventListener("mousedown", onContentDown);
      doc.addEventListener("wheel", onUserScrollNavigationInput, { passive: true });
      doc.addEventListener("touchstart", onUserScrollNavigationInput, { passive: true });
      doc.addEventListener("pointerdown", onUserNavigationInput);
      doc.addEventListener("keydown", onUserScrollNavigationInput);
      doc.addEventListener("mousemove", onContentMove);
      doc.addEventListener("mouseout", onContentOut);
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      detach();
    };
  }, [index]);

  useEffect(() => {
    if (docRef.current) cbRef.current.decorate?.(index, docRef.current);
  }, [decorateNonce, index]);

  const srcDoc = useMemo(() => buildSrcDoc(html, styleCss), [html, styleCss]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      title={`section-${index}`}
      scrolling="no"
      // Đặt height ngay từ lần render đầu. Chromium mặc định iframe cao 150px trước load;
      // section phía trên co rồi giãn sẽ khiến Virtuoso bù scrollTop và làm trang nhảy.
      // Sau load, phép đo thật thay chiều cao ước tính.
      style={{ width: "100%", border: 0, display: "block", height: estimatedHeight ?? 0 }}
    />
  );
}
