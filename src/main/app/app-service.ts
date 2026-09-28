/**
 * AppService là lớp trừu tượng cho API Electron.
 * Module này không import electron; main.ts truyền môi trường và các hàm thực thi.
 * Nhờ vậy module nghiệp vụ/hạ tầng có thể kiểm thử mà không cần Electron.
 * Spec: docs/specs/2026-06-07-app-service-design.md
 */
import path from "node:path";

/** Môi trường chạy do main.ts cung cấp; tên trường không phụ thuộc Electron. */
export interface AppServiceEnv {
  /** Thư mục dữ liệu ứng dụng từ app.getPath("userData"); giữ kín sau khi truyền vào. */
  dataDir: string;
  /** Có đang chạy chế độ phát triển không. */
  isDev: boolean;
  /** Mở thư mục trong trình quản lý tệp hệ thống qua shell.openPath.
   * Có thể chuyển sang FileService khi module đó được thiết kế. */
  openFolder: (dir: string) => Promise<void>;
}

/** Key đường dẫn dữ liệu: hậu tố Dir là thư mục, File là đường dẫn tệp.
 * logsDir cho logger, booksDir chứa sách, dbFile là SQLite. */
export type DataPathKey = "logsDir" | "booksDir" | "dbFile" | "tmpDir" | "preRestoreDir";

/** Ánh xạ key sang đường dẫn tương đối trong dataDir; cấu trúc thư mục tập trung ở đây. */
const DATA_PATHS: Record<DataPathKey, string> = {
  logsDir: "logs",
  booksDir: "books",
  dbFile: "marginalia.db", // DB nằm ở gốc dataDir; đổi vị trí cần migration.
  tmpDir: "tmp", // Tệp tạm sao lưu/khôi phục cùng ổ đĩa để rename được.
  preRestoreDir: "pre-restore", // Nơi giữ bản sao an toàn trước khi khôi phục.
};

/** Không export lớp; bên dùng lấy singleton appService qua barrel. */
class AppService {
  #env: AppServiceEnv | null = null;

  /** Nếu truyền nhiều lần, giá trị mới nhất thắng; kiểm thử dựa vào hành vi này. */
  init(env: AppServiceEnv): void {
    this.#env = env;
  }

  /**
   * appService phải luôn sẵn sàng sau khởi tạo: main.ts đăng ký ở bản thật,
   * Vitest setup đăng ký trong kiểm thử. Truy cập trước khi đăng ký là lỗi khởi tạo.
   */
  get #required(): AppServiceEnv {
    if (!this.#env) {
      throw new Error("AppService not initialized — initAppService must run before any consumer");
    }
    return this.#env;
  }

  /** Tính đường dẫn theo key; không truy cập đĩa, bên gọi tự tạo thư mục nếu cần. */
  getPath(key: DataPathKey): string {
    return path.join(this.#required.dataDir, DATA_PATHS[key]);
  }

  get isDev(): boolean {
    return this.#required.isDev;
  }

  openFolder(dir: string): Promise<void> {
    return this.#required.openFolder(dir);
  }
}

const service = new AppService();

/** Hook vòng đời chỉ main.ts và kiểm thử dùng trực tiếp; không export qua barrel. */
export function initAppService(env: AppServiceEnv): void {
  service.init(env);
}

/** Singleton chỉ đọc; không lộ dataDir gốc để đường dẫn được quản lý tập trung. */
export const appService: {
  getPath(key: DataPathKey): string;
  readonly isDev: boolean;
  openFolder(dir: string): Promise<void>;
} = service;
