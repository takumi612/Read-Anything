/** Locator tiến độ PDF gồm tiền tố `pdf:` và JSON; chỉ trình đọc PDF diễn giải nội dung. */
export interface PdfProgressLocator {
  page: number; // 1-based
  scrollRatio: number; // Tỉ lệ vị trí cuộn trong trang [0,1).
  zoom?: number; // persisted per PDF; old locators without this field remain valid
  viewMode?: "continuous" | "single";
  fitMode?: "custom" | "width" | "page";
  rotation?: 0 | 90 | 180 | 270;
}

export function makePdfLocator(loc: PdfProgressLocator): string {
  return `pdf:${JSON.stringify({ page: loc.page, scrollRatio: loc.scrollRatio, ...(loc.zoom ? { zoom: loc.zoom } : {}), ...(loc.viewMode ? { viewMode: loc.viewMode } : {}), ...(loc.fitMode ? { fitMode: loc.fitMode } : {}), ...(loc.rotation ? { rotation: loc.rotation } : {}) })}`;
}

export function parsePdfLocator(s: string): PdfProgressLocator | null {
  if (!s.startsWith("pdf:")) return null;
  try {
    const v: unknown = JSON.parse(s.slice(4));
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as { page?: unknown }).page === "number" &&
      (v as { page: number }).page >= 1
    ) {
      const ratio = (v as { scrollRatio?: unknown }).scrollRatio;
      const zoom = (v as { zoom?: unknown }).zoom;
      const viewMode = (v as { viewMode?: unknown }).viewMode;
      const fitMode = (v as { fitMode?: unknown }).fitMode;
      const rotation = (v as { rotation?: unknown }).rotation;
      return {
        page: (v as { page: number }).page,
        scrollRatio: typeof ratio === "number" ? ratio : 0,
        ...(typeof zoom === "number" && Number.isFinite(zoom) && zoom > 0 ? { zoom } : {}),
        ...(viewMode === "continuous" || viewMode === "single" ? { viewMode } : {}),
        ...(fitMode === "custom" || fitMode === "width" || fitMode === "page" ? { fitMode } : {}),
        ...(rotation === 0 || rotation === 90 || rotation === 180 || rotation === 270
          ? { rotation }
          : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * locatorRange của chú thích PDF là khoảng vị trí ký tự [start,end) trong luồng văn bản của trang.
 * Hệ tọa độ là textLayer DOM theo thứ tự getTextContent, không gồm xuống dòng EOL tổng hợp.
 * Vùng chọn và phần tô sáng dùng cùng hệ; không chuyển đổi với vị trí ký tự trong chương ở main process.
 */
export interface PdfRangeLocator {
  page: number; // 1-based
  start: number;
  end: number;
}

export function makePdfLocatorRange(r: PdfRangeLocator): string {
  return `pdf:${JSON.stringify({ page: r.page, start: r.start, end: r.end })}`;
}

export function parsePdfLocatorRange(s: string): PdfRangeLocator | null {
  if (!s.startsWith("pdf:")) return null;
  try {
    const v: unknown = JSON.parse(s.slice(4));
    if (typeof v !== "object" || v === null) return null;
    const { page, start, end } = v as { page?: unknown; start?: unknown; end?: unknown };
    if (typeof page !== "number" || !Number.isInteger(page) || page < 1) return null;
    if (typeof start !== "number" || !Number.isInteger(start) || start < 0) return null;
    if (typeof end !== "number" || !Number.isInteger(end) || end < start) return null;
    return { page, start, end };
  } catch {
    return null;
  }
}
