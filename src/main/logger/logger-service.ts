/**
 * LoggerService ở main: lọc mức, định dạng log, tô màu console và ghi tệp.
 * createLogger tạo logger nhẹ theo module; xử lý thực tế tập trung ở singleton này.
 * Log main ghi stdout và main-*.log; log renderer qua IPC chỉ ghi renderer-*.log.
 * Spec: docs/specs/2026-06-07-persistent-logging-design.md
 */
import { appService } from "../app";
import { appendLogLine, cleanupExpiredLogs, type LogSource } from "./file-sink";

export type LogLevel = "error" | "warn" | "info" | "debug";

/** Logger nhẹ giữ tên module; Error tùy chọn được mở rộng thành message và stack. */
export interface Logger {
  error(message: string, err?: unknown): void;
  warn(message: string, err?: unknown): void;
  info(message: string, err?: unknown): void;
  debug(message: string, err?: unknown): void;
}

const ANSI: Record<LogLevel, string> = {
  error: "\x1b[31m", // Đỏ.
  warn: "\x1b[33m", // Vàng.
  info: "\x1b[36m", // Xanh lam.
  debug: "\x1b[90m", // Xám đậm.
};
const ANSI_RESET = "\x1b[0m";

const CONSOLE_FN: Record<LogLevel, (msg: string) => void> = {
  error: (m) => console.error(m),
  warn: (m) => console.warn(m),
  info: (m) => console.log(m),
  debug: (m) => console.log(m),
};

const MODULE_MAX = 64;
const BODY_MAX = 8192;

/** Chuyển Error/unknown thành dòng bổ sung; normalizeBody xử lý thụt lề. */
function formatErr(err: unknown): string {
  if (err === undefined) return "";
  let text: string;
  if (err instanceof Error) {
    text = err.stack ?? `${err.name}: ${err.message}`;
  } else if (typeof err === "string") {
    text = err;
  } else {
    try {
      text = JSON.stringify(err) ?? "[unserializable]";
    } catch {
      text = "[unserializable]";
    }
  }
  return `\n${text}`;
}

/** Rút tên module về một dòng và giới hạn độ dài để nội dung IPC không phá định dạng log. */
function sanitizeModule(module: string): string {
  return module.replace(/\s+/g, " ").trim().slice(0, MODULE_MAX);
}

/** Chuẩn hóa message và Error: cắt khi quá dài, thụt hai dấu cách cho dòng sau.
 * Dòng đầu vẫn dễ tìm bằng grep; thông điệp nhiều dòng không giả thành log mới. */
function normalizeBody(body: string): string {
  const capped = body.length > BODY_MAX ? `${body.slice(0, BODY_MAX)}…[truncated]` : body;
  const [first = "", ...rest] = capped.split("\n");
  if (rest.length === 0) return first;
  return [first, ...rest.map((l) => `  ${l.trimStart()}`)].join("\n");
}

/** Không export lớp này; bên ngoài dùng createLogger hoặc writeRendererLog. */
class LoggerService {
  #cleanedStamp: string | null = null; // Ngày gần nhất dọn log; ngày mới sẽ dọn lại.

  log(source: LogSource, level: LogLevel, module: string, message: string, err?: unknown): void {
    // Chỉ ghi debug ở chế độ dev.
    if (level === "debug" && !appService.isDev) return;

    const now = new Date();
    const body = normalizeBody(`${message}${formatErr(err)}`);
    const line = `[${now.toISOString()}] [${source}] [${level}] [${sanitizeModule(module)}] ${body}`;

    // Chỉ log của main ra stdout; renderer đã hiện ở DevTools.
    if (source === "main") {
      const colored = process.stdout.isTTY ? `${ANSI[level]}${line}${ANSI_RESET}` : line;
      CONSOLE_FN[level](colored);
    }

    // Lỗi ghi tệp không được làm hỏng nghiệp vụ. Riêng appService chưa đăng ký
    // là lỗi thứ tự khởi tạo nên phải được ném ra ngoài.
    const logsDir = appService.getPath("logsDir");
    try {
      const stamp = now.toISOString().slice(0, 10);
      if (this.#cleanedStamp !== stamp) {
        this.#cleanedStamp = stamp;
        cleanupExpiredLogs(logsDir, now);
      }
      appendLogLine(logsDir, source, line, now);
    } catch {
      if (source !== "main") CONSOLE_FN[level](line); // Giữ dấu vết nếu ghi log renderer lỗi.
      // Log main đã ra console trước đó.
    }
  }
}

const service = new LoggerService();

/** Điểm tạo logger cho từng module nghiệp vụ. */
export function createLogger(module: string): Logger {
  return {
    error: (m, e) => service.log("main", "error", module, m, e),
    warn: (m, e) => service.log("main", "warn", module, m, e),
    info: (m, e) => service.log("main", "info", module, m, e),
    debug: (m, e) => service.log("main", "debug", module, m, e),
  };
}

/** Lối vào dành cho IPC log:write: đánh dấu nguồn renderer, ghi renderer-*.log,
 * không in lại vào stdout của main. */
export function writeRendererLog(level: LogLevel, module: string, message: string): void {
  service.log("renderer", level, module, message);
}
