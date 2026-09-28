import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { qk } from "@renderer/query/keys";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { StatOverview } from "@renderer/stats/StatOverview";
import { DailyBarChart } from "@renderer/stats/DailyBarChart";
import { StreakCard } from "@renderer/stats/StreakCard";
import { BookRanking } from "@renderer/stats/BookRanking";

const DAILY_DAYS = 30;

export function StatsView() {
  const { t } = useTranslation();
  // staleTime:0 và refetchOnMount lấy số liệu mới khi mở tab thống kê; không cần thăm dò liên tục.
  const stats = useQuery({
    queryKey: qk.stats(DAILY_DAYS),
    queryFn: () => window.api.stats.get({ dailyDays: DAILY_DAYS }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (stats.isPending) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{t("stats.loading", "Đang tải thống kê…")}</div>
    );
  }
  if (stats.isError || !stats.data) {
    return (
      <div className="p-6 text-sm text-destructive">{t("stats.loadError", "Không thể tải thống kê")}</div>
    );
  }
  const d = stats.data;
  const hasActivity =
    d.totalSeconds > 0 || d.pageStreak.readingDays > 0 || d.pageStreak.pagesToday > 0;
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        {!hasActivity ? (
          <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            {t("stats.empty", "Reading stats will appear after you start reading.")}
          </div>
        ) : (
          <>
            <StatOverview
              totalSeconds={d.totalSeconds}
              todaySeconds={d.todaySeconds}
              weekSeconds={d.weekSeconds}
            />
            <DailyBarChart daily={d.daily} />
          </>
        )}
        <StreakCard streak={d.pageStreak} />
        {hasActivity && d.perBook.length > 0 && <BookRanking perBook={d.perBook} />}
      </div>
    </ScrollArea>
  );
}
