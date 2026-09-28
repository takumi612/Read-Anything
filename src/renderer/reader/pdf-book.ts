import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AnnotationLayer, AnnotationType, TextLayer } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { PDFLinkService as PdfjsLinkService } from "pdfjs-dist/types/web/pdf_link_service.js";
import type { AnnotationDto } from "@shared/annotations";
import {
  exportPdfAnnotations,
  pdfQuadsFromClientRects,
  type PdfAnnotationExport,
} from "./pdf-annotation-export";
import { parsePdfLocatorRange } from "./pdf-locator";
import { rangeFromOffsets } from "./pdf-annotations";
// Tham chiếu Vite `?url`: dev dùng URL của module nguồn, bản build xuất asset.
// PDF.js tạo module worker riêng cho từng tài liệu từ workerSrc, không dùng trạng thái chung.
// Không dùng `?worker` với GlobalWorkerOptions.workerPort: PDFWorker dùng port chung có race
// khi hủy rồi mở lại tài liệu; thử bằng CDP cho thấy getDocument treo mà không báo lỗi.
// oxlint-disable-next-line import/default -- Module ảo Vite ?url; oxlint không phân giải được default export.
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfLinkService {
  externalLinkEnabled: boolean;
  getDestinationHash(dest: string | unknown[]): string;
  getAnchorUrl(anchor: string): string;
  addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow?: boolean): void;
  goToDestination(dest: string | unknown[]): Promise<void>;
  goToPage(pageNumber: number | string): void;
  executeNamedAction(action: string): void;
}

export interface PdfBook {
  pageCount: number;
  /** Kích thước trang đầu ở scale=1; bản v1 giả định mọi trang cùng cỡ. */
  baseSize: { width: number; height: number };
  readPageText: (pageNumber: number) => Promise<{ text: string; snippetText: string }>;
  /**
   * Vẽ trang index (tính từ 0) lên canvas; nếu có textLayerDiv thì phủ PDF.js TextLayer
   * để hỗ trợ vùng chọn gốc. cssWidth là chiều rộng CSS đích; canvas dùng devicePixelRatio
   * cho pixel vật lý, còn tọa độ textLayer dùng pixel CSS.
   * Trước khi vẽ lại cùng canvas phải cancel() lần trước vì PDF.js không cho phép render đồng thời.
   * canvasReady hoàn tất khi có bitmap. done đợi canvas, textLayer và annotation layer hoàn tất
   * rồi mới cleanup; nó resolve khi thành công hoặc bị hủy, reject khi gặp lỗi vẽ bất ngờ.
   * Bên gọi cần bắt lỗi và hiển thị bản dịch, theo cách xử lý parseError của EpubReader.
   */
  renderPage: (
    index: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    textLayerDiv?: HTMLDivElement,
    annotationLayerDiv?: HTMLDivElement,
    onLinkPage?: (pageNumber: number) => void,
    rotation?: 0 | 90 | 180 | 270,
  ) => { done: Promise<void>; canvasReady: Promise<void>; cancel: () => void };
  exportAnnotations: (annotations: readonly AnnotationDto[]) => Promise<Uint8Array<ArrayBuffer>>;
  destroy: () => void;
}

// Tài nguyên PDF.js nằm ở gốc bản build nhờ vite-plugin-static-copy; dev cung cấp cùng đường dẫn.
// Chuyển sang URL tuyệt đối theo document.baseURI: dev dùng gốc dev server, prod dùng .vite/renderer/main_window/.
const CMAP_URL = new URL("cmaps/", document.baseURI).href;
const STANDARD_FONT_DATA_URL = new URL("standard_fonts/", document.baseURI).href;
const WASM_URL = new URL("wasm/", document.baseURI).href;

export async function createPdfBook(bytes: Uint8Array): Promise<PdfBook> {
  // PDF.js chuyển quyền sở hữu buffer nên truyền bản sao để giữ nguyên bytes trong cache của React Query.
  // cMapUrl cung cấp bảng mã cho phông CID thường gặp trong sách CJK; thiếu nó có thể làm sai textLayer.
  // standardFontDataUrl chứa dữ liệu glyph của 14 phông chuẩn để thay phông Latin không nhúng.
  // wasmUrl cung cấp bộ giải mã JBIG2/JPX; thiếu nó có thể khiến trang ảnh hiện trắng mà không báo lỗi.
  // Phông CJK không nhúng và không có trong bảng thay thế vẫn rơi về phông mặc định.
  // Đây là giới hạn của PDF.js so với cơ chế ghép phông hệ thống trong PDFium của Chrome.
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    wasmUrl: WASM_URL,
  });
  let doc: PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    // Task tải thất bại không tự dọn; destroy rõ ràng để giải phóng trạng thái worker khởi tạo dở.
    await loadingTask.destroy().catch(() => {});
    throw err;
  }
  const first = await doc.getPage(1);
  const base = first.getViewport({ scale: 1 });
  const baseSize = { width: base.width, height: base.height };
  first.cleanup();

  const makeLinkService = (goToPage: (pageNumber: number) => void): PdfLinkService => {
    const goToDestination = async (dest: string | unknown[]) => {
      const explicitDest = typeof dest === "string" ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicitDest)) return;
      const [destRef] = explicitDest;
      let pageNumber: number | null = null;
      if (destRef && typeof destRef === "object") {
        pageNumber = doc.cachedPageNumber(destRef as never);
        if (!pageNumber) pageNumber = (await doc.getPageIndex(destRef as never)) + 1;
      } else if (Number.isInteger(destRef)) {
        pageNumber = (destRef as number) + 1;
      }
      if (pageNumber != null && pageNumber >= 1 && pageNumber <= doc.numPages) goToPage(pageNumber);
    };
    return {
      externalLinkEnabled: true,
      getDestinationHash: (dest) => {
        if (typeof dest === "string") return dest.length > 0 ? `#${encodeURIComponent(dest)}` : "#";
        const encoded = encodeURIComponent(JSON.stringify(dest));
        return encoded.length > 0 ? `#${encoded}` : "#";
      },
      getAnchorUrl: (anchor) => anchor,
      addLinkAttributes: (link, url, newWindow = false) => {
        void newWindow;
        link.href = url;
        link.title = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer nofollow";
      },
      goToDestination,
      goToPage: (pageNumber) => {
        const n = typeof pageNumber === "string" ? Number.parseInt(pageNumber, 10) : pageNumber;
        if (Number.isInteger(n) && n >= 1 && n <= doc.numPages) goToPage(n);
      },
      executeNamedAction: (action) => {
        if (action === "FirstPage") goToPage(1);
        else if (action === "LastPage") goToPage(doc.numPages);
      },
    };
  };

  return {
    pageCount: doc.numPages,
    baseSize,

    readPageText: async (pageNumber) => {
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.numPages) {
        return { text: "", snippetText: "" };
      }
      const page = await doc.getPage(pageNumber);
      // Match textLayer.textContent's offset space. Avoid page.cleanup here: the same
      // page proxy may be rendering its canvas while a full-document search runs.
      const content = await page.getTextContent();
      let text = "";
      let snippetText = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        snippetText += item.str;
        if (item.hasEOL) snippetText += "\n";
      }
      return { text, snippetText };
    },

    renderPage: (
      index,
      canvas,
      cssWidth,
      textLayerDiv,
      annotationLayerDiv,
      onLinkPage,
      rotation = 0,
    ) => {
      let task: RenderTask | null = null;
      let textLayer: InstanceType<typeof TextLayer> | null = null;
      let cancelled = false;
      let resolveCanvasReady!: () => void;
      let rejectCanvasReady!: (error: unknown) => void;
      const canvasReady = new Promise<void>((resolve, reject) => {
        resolveCanvasReady = resolve;
        rejectCanvasReady = reject;
      });
      // Thumbnail renderers only await `done`; keep this auxiliary promise handled there too.
      void canvasReady.catch(() => {});
      const done = (async () => {
        const page = await doc.getPage(index + 1);
        try {
          if (cancelled) {
            resolveCanvasReady();
            return;
          }
          const dpr = window.devicePixelRatio || 1;
          const pageRotation = (page.rotate + rotation) % 360;
          const pageBase = page.getViewport({ scale: 1, rotation: pageRotation });
          const cssScale = cssWidth / pageBase.width;
          const viewport = page.getViewport({ scale: cssScale * dpr, rotation: pageRotation });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("PDF page canvas does not support a 2D rendering context");
          task = page.render({ canvasContext: ctx, canvas, viewport });
          const canvasPromise = task.promise.catch((err) => {
            // RenderingCancelledException là hủy chủ động nên bỏ qua; chuyển tiếp các lỗi khác.
            if ((err as Error).name !== "RenderingCancelledException") throw err;
          });
          void canvasPromise.then(resolveCanvasReady, rejectCanvasReady);
          // textLayer và canvas dùng chung một lần getPage; chỉ cleanup khi cả hai hoàn tất.
          // Vòng đời riêng sẽ gây race giữa page.cleanup() và nhánh còn đang vẽ.
          const textPromise = textLayerDiv
            ? (async () => {
                textLayerDiv.replaceChildren();
                // PDF.js v6 dùng biến CSS --total-scale-factor để tính cỡ chữ span.
                // Viewport của textLayer dùng pixel CSS, không nhân dpr.
                textLayerDiv.style.setProperty("--total-scale-factor", String(cssScale));
                textLayer = new TextLayer({
                  textContentSource: page.streamTextContent(),
                  container: textLayerDiv,
                  viewport: page.getViewport({ scale: cssScale, rotation: pageRotation }),
                });
                await textLayer.render();
              })()
            : Promise.resolve();
          const annotationPromise = annotationLayerDiv
            ? (async () => {
                annotationLayerDiv.replaceChildren();
                annotationLayerDiv.style.setProperty("--total-scale-factor", String(cssScale));
                const linkService = makeLinkService((pageNumber) => onLinkPage?.(pageNumber));
                const annotationLayer = new AnnotationLayer({
                  div: annotationLayerDiv,
                  page,
                  viewport: page.getViewport({
                    scale: cssScale,
                    rotation: pageRotation,
                    dontFlip: true,
                  }),
                  linkService: linkService as unknown as PdfjsLinkService,
                  annotationStorage: doc.annotationStorage,
                  accessibilityManager: null,
                  annotationCanvasMap: null,
                  annotationEditorUIManager: null,
                  structTreeLayer: null,
                  commentManager: null,
                });
                const annotations = (await page.getAnnotations({ intent: "display" })).filter(
                  (a) => a.annotationType === AnnotationType.LINK,
                );
                await annotationLayer.render({
                  annotations,
                  div: annotationLayerDiv,
                  page,
                  viewport: page.getViewport({
                    scale: cssScale,
                    rotation: pageRotation,
                    dontFlip: true,
                  }),
                  linkService: linkService as unknown as PdfjsLinkService,
                  annotationStorage: doc.annotationStorage,
                  renderForms: false,
                });
              })()
            : Promise.resolve();
          const [canvasR, textR, annotationR] = await Promise.allSettled([
            canvasPromise,
            textPromise.catch((err) => {
              // TextLayer.render reject bằng AbortException khi hủy; bỏ qua trường hợp hủy chủ động.
              if (!cancelled) throw err;
            }),
            annotationPromise.catch((err) => {
              if (!cancelled) throw err;
            }),
          ]);
          if (canvasR.status === "rejected") throw canvasR.reason;
          if (textR.status === "rejected") throw textR.reason;
          if (annotationR.status === "rejected") throw annotationR.reason;
        } finally {
          page.cleanup();
        }
      })();
      void done.catch(rejectCanvasReady);
      return {
        done,
        canvasReady,
        cancel: () => {
          cancelled = true;
          task?.cancel();
          textLayer?.cancel();
        },
      };
    },

    exportAnnotations: async (annotations) => {
      const byPage = new Map<number, { annotation: AnnotationDto; start: number; end: number }[]>();
      for (const annotation of annotations) {
        const range = parsePdfLocatorRange(annotation.locatorRange);
        if (!range || range.page > doc.numPages) {
          throw new Error("Không thể lưu chú thích vì vị trí văn bản không còn khớp với PDF.");
        }
        const pageAnnotations = byPage.get(range.page) ?? [];
        pageAnnotations.push({ annotation, start: range.start, end: range.end });
        byPage.set(range.page, pageAnnotations);
      }

      const exportEntries: PdfAnnotationExport[] = [];
      for (const [pageNumber, pageAnnotations] of byPage) {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const host = document.createElement("div");
        host.style.position = "fixed";
        host.style.left = "-10000px";
        host.style.top = "0";
        host.style.width = `${viewport.width}px`;
        host.style.height = `${viewport.height}px`;
        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        textLayerDiv.style.setProperty("--total-scale-factor", "1");
        host.append(textLayerDiv);
        document.body.append(host);
        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport,
        });

        try {
          await textLayer.render();
          const origin = textLayerDiv.getBoundingClientRect();
          for (const { annotation, start, end } of pageAnnotations) {
            const range = rangeFromOffsets(textLayerDiv, start, end);
            if (!range || range.toString() !== annotation.selectedText) {
              throw new Error(
                "Không thể lưu chú thích vì vị trí văn bản không còn khớp với PDF. Hãy tạo lại chú thích đó.",
              );
            }
            const quads = pdfQuadsFromClientRects(
              Array.from(range.getClientRects()),
              origin,
              viewport,
            );
            exportEntries.push({
              id: annotation.id,
              page: pageNumber,
              style: annotation.style,
              note: annotation.note,
              quads,
            });
          }
        } finally {
          textLayer.cancel();
          host.remove();
          page.cleanup();
        }
      }

      return exportPdfAnnotations(doc, exportEntries);
    },

    destroy: () => {
      // PDFDocumentProxy không có destroy(); loadingTask.destroy() giải phóng tài nguyên tài liệu
      // và dừng worker riêng của tài liệu trong chế độ workerSrc.
      void doc.loadingTask.destroy().catch(() => {});
    },
  };
}
