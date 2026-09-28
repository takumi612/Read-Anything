import type { DB } from "@main/db/client";
import type { UILanguage } from "@shared/i18n/language";
import { importBook } from "@main/library/repository";
import { writeBookFile } from "@main/library/book-files";
import { getAppMeta, setAppMeta } from "@main/app-meta/repository";
import { buildSampleEpub } from "@main/onboarding/sample-book";
import { createLogger } from "@main/logger";

const log = createLogger("onboarding");

/**
 * Ở lần chạy đầu, tạo sách mẫu theo ngôn ngữ, lưu DB và bản sao tệp rồi đánh dấu sampleSeeded.
 * Nếu đã tạo, kể cả người dùng đã xóa sách, không tự thêm lại. Lỗi thì ghi warn và thử lần sau.
 * booksDir được truyền vào và dùng cùng đường dẫn import thông thường.
 */
export async function maybeSeedSampleBook(
  db: DB,
  language: UILanguage,
  booksDir: string,
): Promise<void> {
  if (getAppMeta(db, "sampleSeeded") === true) return;
  try {
    const bytes = buildSampleEpub(language);
    const book = await importBook(db, { bytes });
    await writeBookFile(booksDir, book.id, book.format, bytes);
    setAppMeta(db, "sampleSeeded", true);
    log.info(`seeded sample book (${language})`);
  } catch (err) {
    log.warn("sample book seed failed", err);
  }
}
