import { useTranslation } from "react-i18next";
import { formatDuration } from "@renderer/stats/format-duration";

export function StatOverview({
  totalSeconds,
  todaySeconds,
  weekSeconds,
}: {
  totalSeconds: number;
  todaySeconds: number;
  weekSeconds: number;
}) {
  const { t } = useTranslation();
  const h = t("stats.unitHour", "hr");
  const m = t("stats.unitMin", "min");
  const cell = (label: string, seconds: number) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-3xl font-bold tabular-nums">{formatDuration(seconds, h, m)}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-4">
      {cell(t("stats.total", "Tổng"), totalSeconds)}
      {cell(t("stats.today", "Hôm nay"), todaySeconds)}
      {cell(t("stats.week", "7 ngày qua"), weekSeconds)}
    </div>
  );
}
