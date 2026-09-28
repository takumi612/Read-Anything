import type { ChatUIMessage } from "@renderer/ai/types";

/**
 * Thời điểm tin nhắn theo epoch ms. Tin cũ lấy từ MessageDto.createdAt;
 * tin đang gửi hoặc stream chưa có timestamp từ DB nên dùng thời điểm bên gọi cung cấp.
 */
export function messageCreatedAt(m: ChatUIMessage, fallbackMs: number): number {
  return m.metadata?.createdAt ?? fallbackMs;
}

function localDate(ms: number, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone).toPlainDate();
}

/** Có cần dòng ngăn cách ngày giữa tin này và tin trước hay không; prevMs=null là tin đầu danh sách. */
export function startsNewDay(prevMs: number | null, ms: number, timeZone: string): boolean {
  if (prevMs === null) return true;
  return !localDate(prevMs, timeZone).equals(localDate(ms, timeZone));
}

/** Loại nhãn ngày: hôm nay, hôm qua hoặc ngày cũ dùng ngày tuyệt đối. */
export type DayKind = "today" | "yesterday" | "older";

export function dayKind(ms: number, nowMs: number, timeZone: string): DayKind {
  const day = localDate(ms, timeZone);
  const today = localDate(nowMs, timeZone);
  if (day.equals(today)) return "today";
  if (day.equals(today.subtract({ days: 1 }))) return "yesterday";
  return "older";
}

/** Chuỗi ISO theo múi giờ địa phương để dùng trong thuộc tính dateTime của time. */
export function isoAt(ms: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(timeZone).toString({
    timeZoneName: "never",
  });
}
