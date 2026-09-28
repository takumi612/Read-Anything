import { useTranslation } from "react-i18next";
import { isoAt } from "@renderer/ai/message-time";
import { cn } from "@renderer/lib/utils";

/**
 * Ngày giờ đầy đủ chỉ hiện khi rê hoặc focus phía trên bong bóng tin nhắn.
 * Đặt tuyệt đối trong khoảng cách giữa các tin nên không chiếm bố cục khi ẩn.
 */
export function MessageTimestamp({
  at,
  timeZone,
  align,
}: {
  at: number;
  timeZone: string;
  align: "start" | "end";
}) {
  const { i18n } = useTranslation();
  const text = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(at);
  return (
    <time
      dateTime={isoAt(at, timeZone)}
      className={cn(
        "pointer-events-none absolute -top-4 whitespace-nowrap text-[11px] leading-4 tabular-nums text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
        align === "end" ? "end-0" : "start-0",
      )}
    >
      {text}
    </time>
  );
}
