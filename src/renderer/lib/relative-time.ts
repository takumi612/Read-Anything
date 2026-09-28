const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** Tính giá trị và đơn vị thời gian tương đối; fromMs trong quá khứ cho giá trị âm, chưa định dạng theo locale. */
export function relativeParts(
  fromMs: number,
  nowMs: number,
): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  let duration = (fromMs - nowMs) / 1000;
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) return { value: Math.round(duration), unit };
    duration /= amount;
  }
  return { value: Math.round(duration), unit: "year" };
}

/** Định dạng thời gian tương đối theo i18n.language, chẳng hạn "3 ngày trước". */
export function relativeTime(fromMs: number, nowMs: number, locale: string): string {
  const { value, unit } = relativeParts(fromMs, nowMs);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit);
}
