import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@main/logger";
import type { ReadBookBytesResult } from "@shared/library";

const log = createLogger("library");

export type BookFormat = "epub" | "pdf";

/** Báo tệp sách bản sao của ứng dụng bị thiếu để UI gợi ý nối lại. */
export class BookFileMissingError extends Error {
  constructor(public readonly bookId: string) {
    super(`book file missing for book ${bookId}`);
    this.name = "BookFileMissingError";
  }
}

/**
 * Đường dẫn bản sao sách: `booksDir/<sha256(bookId)>.<format>`.
 * Không lưu đường dẫn vào DB vì có thể suy ra từ bookId và format. Công thức này phải ổn định
 * để sách cũ luôn tìm được tệp. Nếu sau này cho đổi books.format, phải xử lý tệp đuôi cũ.
 */
export function storedBookPath(booksDir: string, bookId: string, format: BookFormat): string {
  const name = createHash("sha256").update(bookId).digest("hex");
  return path.join(booksDir, `${name}.${format}`);
}

/** Ghi bytes sách vào thư mục ứng dụng; nối lại hoặc nhập lại sẽ ghi đè bản sao. */
export async function writeBookFile(
  booksDir: string,
  bookId: string,
  format: BookFormat,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(booksDir, { recursive: true });
  await writeFile(storedBookPath(booksDir, bookId, format), bytes);
}

/**
 * Chỉ nối lại khi hash của tệp được chọn bằng bookId gốc. Nếu khác, trả mismatch
 * và không ghi gì. Bên gọi truyền format từ DB để tránh phụ thuộc vòng với repository.
 */
export async function relinkBookFile(
  booksDir: string,
  bookId: string,
  format: BookFormat,
  bytes: Uint8Array,
): Promise<"ok" | "mismatch"> {
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  if (contentHash !== bookId) return "mismatch";
  await writeBookFile(booksDir, bookId, format, bytes);
  return "ok";
}

/** Đọc bản sao của ứng dụng; thiếu tệp thì ném BookFileMissingError. */
export async function readBookFile(
  booksDir: string,
  bookId: string,
  format: BookFormat,
): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(storedBookPath(booksDir, bookId, format)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new BookFileMissingError(bookId);
    throw err;
  }
}

/** Đọc bản sao và trả kết quả an toàn nếu thiếu tệp; lỗi khác để handler xử lý. */
export async function readBookFileResult(
  booksDir: string,
  bookId: string,
  format: BookFormat,
): Promise<ReadBookBytesResult> {
  try {
    const data = await readBookFile(booksDir, bookId, format);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof BookFileMissingError) return { ok: false, error: { reason: "missing" } };
    throw err;
  }
}

/** Cố xóa bản sao khi xóa sách; tệp đã thiếu không phải lỗi nghiêm trọng. */
export async function deleteBookFile(
  booksDir: string,
  bookId: string,
  format: BookFormat,
): Promise<void> {
  await unlink(storedBookPath(booksDir, bookId, format)).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== "ENOENT") log.warn(`unlink ${bookId} failed`, err);
  });
}
