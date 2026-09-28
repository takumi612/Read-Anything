import type { SummaryStatus } from "#/mock/types";

/** Nhãn trạng thái tóm tắt: khóa i18n + màu sắc (dùng chung cho pill ở bảng AI, thẻ bật lên và thẻ sách trong thanh bên). */
export const SUMMARY_BADGE: Record<SummaryStatus, { key: string; cls: string }> = {
  pending: { key: "summary.pending", cls: "bg-muted text-muted-foreground" },
  generating: {
    key: "summary.generating",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  ready: { key: "summary.ready", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  unavailable: { key: "summary.unavailable", cls: "bg-destructive/15 text-destructive" },
};

/** Khóa i18n cho nội dung giữ chỗ khi chưa sẵn sàng (ready trả về chuỗi rỗng; nơi gọi chỉ dùng khi trạng thái khác ready). */
export function summaryPlaceholderKey(status: SummaryStatus): string {
  switch (status) {
    case "generating":
      return "summary.placeholderGenerating";
    case "unavailable":
      return "summary.placeholderUnavailable";
    case "pending":
      return "summary.placeholderPending";
    default:
      return "";
  }
}
