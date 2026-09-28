// Chuyển lời gọi công cụ thành sự kiện tiến độ báo cáo cho người dùng.
import type { ToolSet } from "ai";
import type { ReadingReportProgressOutcome } from "@shared/reading-sessions";
import type { ProgressSink } from "@main/reading-report/runtime";

/** Lấy số mục có thể hiển thị từ kết quả phân trang của công cụ; thiếu thì null. */
export function progressCount(output: unknown): number | null {
  if (typeof output !== "object" || output === null) return null;
  const record = output as Record<string, unknown>;
  for (const key of ["items", "messages"]) {
    const value = record[key];
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

/**
 * Chỉ phân biệt thành công và đã bỏ qua. Lỗi công cụ hoặc tác vụ điều tra bận
 * được trả theo đường dự phòng; UI không báo cả báo cáo hỏng vì một mục lỗi.
 */
export function progressOutcome(output: unknown): ReadingReportProgressOutcome {
  if (typeof output !== "object" || output === null) return "ok";
  const record = output as Record<string, unknown>;
  if (typeof record.error === "string") return "skipped";
  if (record.status === "busy" || record.status === "failed") return "skipped";
  return "ok";
}

type AnyExecute = (input: never, options: never) => unknown;

/**
 * Báo tiến độ khi công cụ bắt đầu và kết thúc. onStepFinish chỉ chạy sau bước,
 * quá muộn để hiện thông báo "đang đọc hội thoại" trong lúc xử lý.
 */
export function withProgress<T extends ToolSet>(tools: T, sink: ProgressSink): T {
  const entries = Object.entries(tools).map(([name, definition]) => {
    const execute = (definition as { execute?: AnyExecute }).execute;
    if (typeof execute !== "function") return [name, definition] as const;
    const wrapped = async (input: never, options: never) => {
      const id = sink.start(name);
      try {
        const output = await execute(input, options);
        sink.finish(id, progressOutcome(output), progressCount(output));
        return output;
      } catch (err) {
        sink.finish(id, "skipped", null);
        throw err;
      }
    };
    return [name, { ...definition, execute: wrapped }] as const;
  });
  return Object.fromEntries(entries) as T;
}
