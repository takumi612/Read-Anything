/** Seconds to readable duration; unit labels are localized by the caller. */
export function formatDuration(totalSeconds: number, hLabel: string, mLabel: string): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes} ${mLabel}`;
  if (minutes === 0) return `${hours} ${hLabel}`;
  return `${hours} ${hLabel} ${minutes} ${mLabel}`;
}
