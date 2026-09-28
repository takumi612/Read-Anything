import { z } from "zod";

/** Renderer báo sách đang đọc cho main khi vào/ra reader; null tạm dừng đồng hồ đọc. */
export const statsReadingStateInput = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("active"), bookId: z.string().min(1) }),
]);
export type StatsReadingStateInput = z.infer<typeof statsReadingStateInput>;

/** Lấy thống kê; dailyDays chọn số ngày hiển thị, handler dùng 30 nếu thiếu.
 * Không dùng Zod .default() ở đây vì kiểu đầu vào của invoker sẽ coi trường này là bắt buộc. */
export const statsGetInput = z.object({
  dailyDays: z.number().int().positive().max(366).optional(),
});
export type StatsGetInput = z.infer<typeof statsGetInput>;

export const recordPageReadInput = z.object({
  bookId: z.string().min(1),
  pageNumber: z.number().int().positive().max(2_000_000),
  totalPages: z.number().int().positive().max(2_000_000),
}).refine((value) => value.pageNumber <= value.totalPages, {
  message: "pageNumber cannot exceed totalPages",
});
export type RecordPageReadInput = z.infer<typeof recordPageReadInput>;

/** Tổng số liệu của một ngày, dùng cho biểu đồ cột. */
export interface DailyPoint {
  day: string; // 'YYYY-MM-DD'
  seconds: number;
}

export interface PageDailyPoint {
  day: string;
  pages: number;
}

export interface PageStreakDto {
  goal: number;
  pagesToday: number;
  currentStreak: number;
  longestStreak: number;
  readingDays: number;
  daily: PageDailyPoint[];
}

/** Result from confirming a page: daily streak and book completion remain separate values. */
export interface RecordPageReadResultDto {
  pageStreak: PageStreakDto;
  bookProgress: {
    confirmedPages: number;
    percent: number;
  };
}

/** Thời gian đọc theo sách còn trong thư viện. */
export interface BookReadingTotal {
  bookId: string;
  title: string | null;
  author: string | null;
  seconds: number;
}

/** Dữ liệu cần cho trang thống kê. */
export interface ReadingStatsDto {
  totalSeconds: number;
  todaySeconds: number;
  weekSeconds: number; // Bảy ngày gần nhất, tính cả hôm nay.
  currentStreak: number; // Số ngày liên tiếp hiện tại.
  longestStreak: number; // Chuỗi ngày dài nhất.
  readingDays: number; // Tổng số ngày đạt mục tiêu.
  daily: DailyPoint[]; // Các ngày theo thứ tự tăng, ngày trống có giá trị 0.
  perBook: BookReadingTotal[]; // Sách còn trong thư viện, sắp theo thời gian giảm dần.
  pageStreak: PageStreakDto;
}
