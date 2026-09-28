/**
 * LoggerService của renderer có cùng cấu trúc với main process: class và singleton không xuất ra,
 * barrel chỉ xuất createLogger. Ghi vào console DevTools và gửi log:write IPC để main process
 * ghi renderer-*.log. Main process quyết định ngưỡng cấp độ, renderer chuyển tiếp mọi log.
 */
import type { LogWriteInput } from "@shared/ipc";

type LogLevel = LogWriteInput["level"];

export interface Logger {
  error(message: string, err?: unknown): void;
  warn(message: string, err?: unknown): void;
  info(message: string, err?: unknown): void;
  debug(message: string, err?: unknown): void;
}

const CONSOLE_FN: Record<LogLevel, (...args: unknown[]) => void> = {
  error: console.error,
  warn: console.warn,
  info: console.log,
  debug: console.debug,
};

/** Chuyển lỗi thành chuỗi để truyền qua IPC vì contextBridge chỉ nhận dữ liệu thuần.
 * Error dùng stack hoặc tên và thông báo; chuỗi giữ nguyên; kiểu khác thử JSON.stringify
 * với nhánh dự phòng cho vòng tham chiếu, bigint, symbol và function. */
function withErr(message: string, err?: unknown): string {
  if (err === undefined) return message;
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
  return `${message}\n${text}`;
}

/** Cắt thông báo trước giới hạn message.max của schema để log dài vẫn được lưu. */
const MESSAGE_MAX = 8192;
const MODULE_MAX = 64;

class LoggerService {
  log(level: LogLevel, module: string, message: string, err?: unknown): void {
    // Console DevTools giữ object lỗi gốc để inspect, với định dạng giống log trong tệp.
    CONSOLE_FN[level](
      `[renderer] [${level}] [${module}] ${message}`,
      ...(err === undefined ? [] : [err]),
    );
    // Gửi log qua IPC không chờ kết quả; lỗi ghi log không được làm hỏng UI.
    void window.api.log
      .write({
        level,
        module: module.slice(0, MODULE_MAX) || "renderer",
        message: withErr(message, err).slice(0, MESSAGE_MAX),
      })
      .catch(() => {});
  }
}

const service = new LoggerService();

export function createLogger(module: string): Logger {
  return {
    error: (m, e) => service.log("error", module, m, e),
    warn: (m, e) => service.log("warn", module, m, e),
    info: (m, e) => service.log("info", module, m, e),
    debug: (m, e) => service.log("debug", module, m, e),
  };
}
