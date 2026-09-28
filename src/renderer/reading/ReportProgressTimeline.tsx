import { useEffect, useState } from "react";
import { Check, Loader2, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReadingReportProgressStep } from "@shared/reading-sessions";

/** Cập nhật mỗi giây để mục đang chạy tự đếm thời gian; main process chỉ gửi timestamp. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Temporal.Now.instant().epochMilliseconds);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Temporal.Now.instant().epochMilliseconds), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Ánh xạ tên công cụ sang khóa bản dịch. Viết rõ từng cặp vì khóa i18n có kiểu union;
 * ghép chuỗi động sẽ không qua kiểm tra kiểu, còn bảng này bảo đảm khóa tồn tại.
 */
const TOOL_LABEL_KEYS = {
  getBookSummary: "readingReport.progress.tool.getBookSummary",
  getChapterSummary: "readingReport.progress.tool.getChapterSummary",
  getPreviousReadingReport: "readingReport.progress.tool.getPreviousReadingReport",
  getSessionReadingStats: "readingReport.progress.tool.getSessionReadingStats",
  getToc: "readingReport.progress.tool.getToc",
  investigateConversation: "readingReport.progress.tool.investigateConversation",
  listAnnotations: "readingReport.progress.tool.listAnnotations",
  listBookNotes: "readingReport.progress.tool.listBookNotes",
  listConversations: "readingReport.progress.tool.listConversations",
  listPreviousReadingSessions: "readingReport.progress.tool.listPreviousReadingSessions",
  readChapterText: "readingReport.progress.tool.readChapterText",
  readConversation: "readingReport.progress.tool.readConversation",
  readMemory: "readingReport.progress.tool.readMemory",
  readPage: "readingReport.progress.tool.readPage",
  saveMemory: "readingReport.progress.tool.saveMemory",
  updateMemory: "readingReport.progress.tool.updateMemory",
} as const;

function formatSeconds(milliseconds: number): string {
  const total = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
}

export function ReportProgressTimeline({
  progress,
  startedAt,
}: {
  progress: readonly ReadingReportProgressStep[];
  startedAt: number | null;
}) {
  const { t } = useTranslation();
  const now = useNow(startedAt != null);
  if (progress.length === 0 && startedAt == null) return null;

  const done = progress.filter((step) => step.endedAt != null).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {startedAt != null ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span className="text-foreground">{t("readingReport.progress.title")}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {t("readingReport.progress.elapsed", { elapsed: formatSeconds(now - startedAt) })}
            </span>
          </>
        ) : null}
        {progress.length > 0 ? (
          <>
            {startedAt != null ? <span aria-hidden>·</span> : null}
            <span className="tabular-nums">
              {t("readingReport.progress.steps", { count: done })}
            </span>
          </>
        ) : null}
      </div>

      <ol className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
        {progress.map((step) => (
          <TimelineRow key={step.id} step={step} now={now} />
        ))}
      </ol>
    </div>
  );
}

function TimelineRow({ step, now }: { step: ReadingReportProgressStep; now: number }) {
  const { t } = useTranslation();
  const running = step.endedAt == null;
  const skipped = step.outcome === "skipped";
  // Công cụ chưa có ánh xạ dùng nhãn chung để không lộ tên kỹ thuật trên giao diện.
  const labelKey =
    step.tool in TOOL_LABEL_KEYS
      ? TOOL_LABEL_KEYS[step.tool as keyof typeof TOOL_LABEL_KEYS]
      : "readingReport.progress.tool.unknown";

  return (
    <li className="flex items-baseline gap-2">
      <span className="relative top-0.5 shrink-0 text-muted-foreground">
        {running ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : skipped ? (
          <Minus className="size-3.5" />
        ) : (
          <Check className="size-3.5" />
        )}
      </span>
      <span className={running ? "text-foreground" : "text-muted-foreground"}>{t(labelKey)}</span>
      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
        {running
          ? formatSeconds(now - step.startedAt)
          : skipped
            ? t("readingReport.progress.skipped")
            : step.count != null
              ? t("readingReport.progress.count", { count: step.count })
              : null}
      </span>
    </li>
  );
}
