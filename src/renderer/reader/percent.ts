/** Tính tiến độ đọc dùng chung cho progress.percent gửi lên và breadcrumb trên thanh đầu. */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Với ePub, cân theo lượng văn bản đọc được; thiếu hồ sơ văn bản thì dùng tỉ lệ spine. */
export function epubPercent(
  index: number,
  textOffset: number | null,
  textLengths: readonly number[],
  scrollRatio: number,
): number {
  const sectionCount = textLengths.length;
  if (sectionCount === 0) return 0;

  const safeIndex = Math.floor(index);
  if (safeIndex < 0) return 0;
  if (safeIndex >= sectionCount) return 1;

  const lengths = textLengths.map((length) => (Number.isFinite(length) ? Math.max(0, length) : 0));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const ratio = Number.isFinite(scrollRatio) ? clamp01(scrollRatio) : 0;

  if (total === 0) return clamp01((safeIndex + ratio) / sectionCount);

  const completed = lengths.slice(0, safeIndex).reduce((sum, length) => sum + length, 0);
  const currentLength = lengths[safeIndex] ?? 0;
  const current =
    textOffset === null || !Number.isFinite(textOffset)
      ? ratio * currentLength
      : Math.min(Math.max(textOffset, 0), currentLength);
  return clamp01((completed + current) / total);
}

/** Với PDF, tính chính xác theo tỉ lệ trang. */
export function pdfPercent(page: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return clamp01(page / pageCount);
}
