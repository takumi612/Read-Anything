/** Khi mở sách ở vị trí sâu, giữ placeholder nhẹ cho section phía trên để số đo muộn không đẩy lệch đích. */
export function deferBeforeLoadedIndex(loadedFromIndex: number, index: number): boolean {
  return index < loadedFromIndex;
}

/** Nhảy bằng lệnh chỉ mở section đích và phía sau; section đã mở không bị đóng lại. */
export function loadedFromIndexAfterNavigation(current: number, target: number): number {
  return Math.min(current, target);
}

/** Chỉ mở dần section theo đầu viewport thực tế sau khi xác nhận có thao tác cuộn. */
export function loadedFromIndexAfterVisibleTop(
  current: number,
  visibleTop: number,
  rangeLoadingEnabled: boolean,
): number {
  return rangeLoadingEnabled ? Math.min(current, visibleTop) : current;
}

export function estimateHeight(
  cache: ReadonlyMap<number, number>,
  index: number,
  defaultEstimate: number,
): number {
  return cache.get(index) ?? defaultEstimate;
}

/**
 * Ước tính chiều cao có hiệu chỉnh: dùng cache nếu có; nếu chưa đo, nhân trọng số đích
 * (do bên dùng cung cấp, chẳng hạn số ký tự chương) với tỷ lệ px/trọng số của section đã đo.
 * Dùng defaultEstimate nếu không có hàm trọng số, mẫu hợp lệ hoặc trọng số đích; bỏ mẫu trọng số 0.
 */
export function calibratedEstimate(
  cache: ReadonlyMap<number, number>,
  weightOf: ((index: number) => number) | undefined,
  index: number,
  defaultEstimate: number,
  initialPxPerWeight = 0,
): number {
  const cached = cache.get(index);
  if (cached != null) return cached;
  if (!weightOf) return defaultEstimate;
  const targetWeight = weightOf(index);
  if (targetWeight <= 0) return defaultEstimate;
  let sumHeight = 0;
  let sumWeight = 0;
  for (const [i, h] of cache) {
    const w = weightOf(i);
    if (w <= 0) continue;
    sumHeight += h;
    sumWeight += w;
  }
  if (sumWeight <= 0) {
    return initialPxPerWeight > 0
      ? Math.max(defaultEstimate, targetWeight * initialPxPerWeight)
      : defaultEstimate;
  }
  return targetWeight * (sumHeight / sumWeight);
}

/**
 * Các chỉ số section cần gỡ tải vì cách active range quá keepDistance.
 * Giữ đoạn [startIndex - keepDistance, endIndex + keepDistance] và loại mọi phần tử bên ngoài.
 */
export function sectionsToUnload(
  range: { startIndex: number; endIndex: number },
  total: number,
  keepDistance: number,
): number[] {
  const lo = range.startIndex - keepDistance;
  const hi = range.endIndex + keepDistance;
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    if (i < lo || i > hi) out.push(i);
  }
  return out;
}

/**
 * Chọn section ở đầu viewport từ tọa độ top/bottom của các section và đường viewportTop.
 * Ưu tiên section cắt qua đường này; nếu không có, chọn section gần nhất phía dưới,
 * hoặc section gần nhất phía trên nếu tất cả đều nằm trên đường. Danh sách rỗng trả về null.
 */
export function topVisibleIndex(
  sections: ReadonlyArray<{ index: number; top: number; bottom: number }>,
  viewportTop: number,
): number | null {
  if (sections.length === 0) return null;
  const crossing = sections.filter((s) => s.top <= viewportTop && s.bottom > viewportTop);
  if (crossing.length > 0) {
    return crossing.reduce((a, b) => (b.top > a.top ? b : a)).index;
  }
  const below = sections.filter((s) => s.top >= viewportTop);
  if (below.length > 0) {
    return below.reduce((a, b) => (b.top < a.top ? b : a)).index;
  }
  return sections.reduce((a, b) => (b.bottom > a.bottom ? b : a)).index;
}

export function topVisibleSection(
  sections: ReadonlyArray<{ index: number; top: number; bottom: number }>,
  viewportTop: number,
): { index: number; top: number; bottom: number } | null {
  const index = topVisibleIndex(sections, viewportTop);
  return index == null ? null : (sections.find((s) => s.index === index) ?? null);
}

export function sectionScrollRatio(
  section: { top: number; bottom: number },
  viewportTop: number,
): number {
  const height = Math.max(1, section.bottom - section.top);
  return Math.min(1, Math.max(0, (viewportTop - section.top) / height));
}
