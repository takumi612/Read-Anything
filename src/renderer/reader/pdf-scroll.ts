/**
 * Ước tính vị trí cuộn PDF khi mọi trang cùng cỡ, theo bố cục Virtuoso của PdfReader.
 * Mỗi mục cao pageH + PAGE_GAP vì có đệm py-2 trên và dưới. Nội dung trang page tính từ 1
 * bắt đầu tại (page-1)*(pageH+PAGE_GAP) + PAGE_PADDING_Y. Ưu tiên positionAtViewportTop
 * đọc bố cục thực; các công thức này dùng để khôi phục ban đầu, neo zoom và dự phòng khi thiếu DOM.
 */
export const PAGE_PADDING_Y = 8;
export const PAGE_GAP = 16;

export interface PdfViewportPage {
  page: number;
  top: number;
  height: number;
}

/** Resolve the reading location from the pages actually laid out in the virtualized viewport. */
export function positionAtViewportTop(
  viewportTop: number,
  pages: readonly PdfViewportPage[],
): { page: number; scrollRatio: number } | null {
  const laidOut = pages
    .filter((page) => Number.isInteger(page.page) && page.page > 0 && page.height > 0)
    .toSorted((left, right) => left.top - right.top);
  if (laidOut.length === 0) return null;

  const pageAtTop = laidOut.find(
    (page) => page.top <= viewportTop && page.top + page.height > viewportTop,
  );
  const pageInGap = [...laidOut].reverse().find((page) => page.top + page.height <= viewportTop);
  const page = pageAtTop ?? pageInGap ?? laidOut[0]!;
  return {
    page: page.page,
    scrollRatio: Math.min(1, Math.max(0, (viewportTop - page.top) / page.height)),
  };
}

/** Trang chứa tọa độ Y của nội dung. Cộng PAGE_PADDING_Y để ranh giới ở cuối nội dung trang trước;
 *  khoảng trống giữa trang thuộc trang sau, còn intraPageRatio giới hạn tỉ lệ trong trang. */
export function topPageAt(y: number, pageH: number, pageCount: number): number {
  const page = Math.floor((y + PAGE_PADDING_Y) / (pageH + PAGE_GAP)) + 1;
  return Math.min(pageCount, Math.max(1, page));
}

/** Tỉ lệ vị trí Y trong trang page, giới hạn trong [0,1], kể cả ở khoảng trống giữa trang. */
export function intraPageRatio(y: number, page: number, pageH: number): number {
  const contentTop = (page - 1) * (pageH + PAGE_GAP) + PAGE_PADDING_Y;
  return Math.min(1, Math.max(0, (y - contentTop) / pageH));
}

/** Đổi số trang và tỉ lệ trong trang về tọa độ Y, ngược với intraPageRatio. */
export function scrollTopFor(page: number, ratio: number, pageH: number): number {
  return (page - 1) * (pageH + PAGE_GAP) + PAGE_PADDING_Y + ratio * pageH;
}

/**
 * Offset cho scrollToIndex của Virtuoso khi khôi phục cuộn dọc sau zoom.
 * Với align:'start', scrollTop = (page-1)*(pageH+PAGE_GAP) + offset.
 * Để điểm ở tỉ lệ ratio nằm tại anchorY trong khung nhìn, cần
 * scrollTop = scrollTopFor(page, ratio, pageH) - anchorY; suy ra
 * offset = PAGE_PADDING_Y + ratio*pageH - anchorY, không phụ thuộc số trang.
 * Dùng lệnh của Virtuoso để tránh lần resize sau ghi đè scrollTop gán trực tiếp.
 */
export function zoomScrollOffset(ratio: number, pageH: number, anchorY: number): number {
  return PAGE_PADDING_Y + ratio * pageH - anchorY;
}

/**
 * Khôi phục cuộn ngang sau zoom với scale bằng pageH mới chia pageH cũ,
 * giữ điểm nội dung tại X ở đúng anchorX. Gán scroller.scrollLeft trực tiếp vì Virtuoso
 * không quản lý chiều ngang; có sai số nhỏ khi trang chuyển giữa căn giữa và tràn khung.
 */
export function zoomScrollLeft(oldScrollLeft: number, anchorX: number, scale: number): number {
  return Math.max(0, (oldScrollLeft + anchorX) * scale - anchorX);
}
