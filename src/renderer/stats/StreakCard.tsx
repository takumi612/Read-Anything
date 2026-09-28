import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PageStreakDto } from "@shared/stats";
import { cn } from "@renderer/lib/utils";
import { buildMonthCalendar } from "@renderer/stats/month-calendar";

export function StreakCard({ streak }: { streak: PageStreakDto }) {
  const { t, i18n } = useTranslation();
  const litToday = streak.pagesToday >= streak.goal;
  const pagesToday = Math.min(streak.pagesToday, streak.goal);
  const progress = (pagesToday / streak.goal) * 100;
  const remaining = streak.goal - pagesToday;
  const calendar = buildMonthCalendar(streak.daily);
  const today = streak.daily.at(-1)?.day;
  const monthLabel = today
    ? Temporal.PlainDate.from(today).toLocaleString(i18n.language, {
        month: "long",
        year: "numeric",
      })
    : "";
  const weekdays = [
    t("streak.weekdayMon", "Mon"),
    t("streak.weekdayTue", "Tue"),
    t("streak.weekdayWed", "Wed"),
    t("streak.weekdayThu", "Thu"),
    t("streak.weekdayFri", "Fri"),
    t("streak.weekdaySat", "Sat"),
    t("streak.weekdaySun", "Sun"),
  ];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-full bg-muted transition-colors",
            litToday && "bg-orange-500/10",
          )}
        >
          <Flame
            aria-hidden="true"
            className={cn(
              "size-7 text-muted-foreground",
              litToday && "text-orange-500 motion-safe:animate-[streak-ignite_420ms_ease-out]",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            {streak.currentStreak > 0
              ? t("streak.current", { count: streak.currentStreak })
              : t("streak.startTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("streak.longest", { count: streak.longestStreak })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums">
            {pagesToday}
            <span className="text-sm font-normal text-muted-foreground">/{streak.goal}</span>
          </div>
          <div className="text-xs text-muted-foreground">{t("streak.pagesToday")}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={t("streak.todayProgress")}
          aria-valuemin={0}
          aria-valuemax={streak.goal}
          aria-valuenow={Math.min(streak.pagesToday, streak.goal)}
        >
          <div
            className={cn(
              "h-full rounded-full bg-primary transition-[width] duration-500",
              litToday && "bg-orange-500",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {litToday ? t("streak.todayLit") : t("streak.pagesRemaining", { count: remaining })}
        </p>
      </div>

      <div
        className="space-y-2"
        role="group"
        aria-label={t("streak.monthTitle", { month: monthLabel })}
      >
        <h3 className="text-sm font-medium">{t("streak.monthTitle", { month: monthLabel })}</h3>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
          {weekdays.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-1.5"
          role="list"
          aria-label={t("streak.monthTitle", { month: monthLabel })}
        >
          {calendar.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} aria-hidden="true" />;
            const complete = day.pages >= streak.goal;
            const label = day.isFuture
              ? t("streak.futureDay", { day: day.day })
              : t("streak.daySummary", { day: day.day, pages: day.pages });
            return (
              <div
                key={day.day}
                role="listitem"
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md bg-muted/40 py-1",
                  day.isFuture && "opacity-45",
                )}
                aria-label={label}
                title={label}
              >
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {day.day.slice(-2)}
                </span>
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full",
                    complete ? "text-orange-500" : "text-muted-foreground/50",
                    day.isToday && !complete && "ring-1 ring-primary/40",
                  )}
                >
                  {complete ? (
                    <Flame aria-hidden="true" className="size-3.5" />
                  ) : (
                    <span aria-hidden="true" className="size-1 rounded-full bg-current" />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("streak.pageCountNote")}</p>
    </section>
  );
}
