import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Xác định thư mục migration trong dev/bản phát hành; phụ thuộc Electron. */
export function resolveMigrationsFolder(): string {
  const devUrl =
    typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined"
      ? MAIN_WINDOW_VITE_DEV_SERVER_URL
      : undefined;
  return devUrl
    ? path.resolve(process.cwd(), "src/main/db/migrations")
    : path.join(process.resourcesPath, "migrations");
}

/** Liệt kê thư mục migration theo thứ tự tên; dạng <timestamp>_<name>. */
export function listMigrationDirs(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Lấy thư mục migration mới nhất theo tên; không có thì trả chuỗi rỗng. */
export function latestMigrationDir(folder: string): string {
  const dirs = listMigrationDirs(folder);
  return dirs.length ? dirs[dirs.length - 1] : "";
}
