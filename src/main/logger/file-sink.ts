/**
 * Ghi log theo ngày và nguồn tiến trình, dọn tệp quá 30 ngày.
 * LoggerService truyền logsDir vào nên module có thể kiểm thử độc lập.
 */
import { appendFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

export type LogSource = "main" | "renderer";

const RETENTION_DAYS = 30;
const LOG_FILE_RE = /^(?:main|renderer)-(\d{4}-\d{2}-\d{2})\.log$/;

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10); // Ngày UTC cùng hệ quy chiếu với timestamp trong log.
}

export function logFileName(source: LogSource, date: Date): string {
  return `${source}-${dateStamp(date)}.log`;
}

/** Ghi một dòng, tạo thư mục khi cần; lỗi được LoggerService xử lý bằng console. */
export function appendLogLine(logsDir: string, source: LogSource, line: string, date: Date): void {
  mkdirSync(logsDir, { recursive: true });
  appendFileSync(path.join(logsDir, logFileName(source, date)), `${line}\n`);
}

/** Xóa log cũ hơn 30 ngày; giữ tệp khác và bỏ qua nếu thư mục chưa tồn tại. */
export function cleanupExpiredLogs(logsDir: string, now: Date): void {
  let entries: string[];
  try {
    entries = readdirSync(logsDir);
  } catch {
    return; // Dọn log là thao tác cố gắng, không chặn ứng dụng.
  }
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffStamp = dateStamp(cutoff);
  for (const name of entries) {
    const m = LOG_FILE_RE.exec(name);
    if (m && m[1] < cutoffStamp) {
      try {
        rmSync(path.join(logsDir, name));
      } catch {
        // Một tệp xóa lỗi không chặn các tệp còn lại.
      }
    }
  }
}
