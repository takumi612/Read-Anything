import { z } from "zod";

export const importBookInput = z.object({ filePath: z.string().min(1) });
export type ImportBookInput = z.infer<typeof importBookInput>;

export const bookIdInput = z.object({ bookId: z.string().min(1) });
export type BookIdInput = z.infer<typeof bookIdInput>;

export const readerDataCategory = z.enum(["annotations", "vocabulary", "bookmarks", "notes"]);
export type ReaderDataCategory = z.infer<typeof readerDataCategory>;

export const clearBookCategoryInput = bookIdInput.extend({ category: readerDataCategory });
export type ClearBookCategoryInput = z.infer<typeof clearBookCategoryInput>;

/** #70 Đổi trạng thái đã đọc xong; phải truyền finished, độc lập với tiến độ đọc. */

/** #29 Sửa thông tin sách theo kiểu put: cần cả hai trường; author=null để xóa tên tác giả.
 * Biểu mẫu chuyển chuỗi rỗng thành null; schema này chặn chuỗi rỗng nếu gọi IPC trực tiếp. */
export const updateBookInput = z.object({
  bookId: z.string().min(1),
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(500).nullable(),
});
export type UpdateBookInput = z.infer<typeof updateBookInput>;

export const saveProgressInput = z.object({
  bookId: z.string().min(1),
  locator: z.string().min(1),
});
export type SaveProgressInput = z.infer<typeof saveProgressInput>;

/** Persisted reader location and confirmed page-based completion. */
export interface ProgressDto {
  locator: string | null;
  percent: number | null;
}

export const chapterRefInput = z.object({
  bookId: z.string().min(1),
  chapterId: z.string().min(1),
});
export type ChapterRefInput = z.infer<typeof chapterRefInput>;

export const readChapterTextInput = chapterRefInput.extend({
  offset: z.number().int().nonnegative().optional(),
  maxChars: z.number().int().positive().optional(),
});
export type ReadChapterTextInput = z.infer<typeof readChapterTextInput>;

/** Tạo lại thủ công dùng force: true; tác vụ tự động bỏ qua nếu nội dung đã sẵn sàng. */
export const generateChapterSummaryInput = chapterRefInput.extend({
  force: z.boolean().optional(),
});
export type GenerateChapterSummaryInput = z.infer<typeof generateChapterSummaryInput>;

export interface BookSummaryDto {
  id: string;
  title: string | null;
  author: string | null;
  hasCover: boolean;
  format: "epub" | "pdf";
  pageCount: number | null;
  hasTextLayer: boolean;
  readingState: import("@shared/reading-sessions").BookReadingState;
}

export const reorderBooksInput = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
export type ReorderBooksInput = z.infer<typeof reorderBooksInput>;

/** Mục "Đọc tiếp" trên kệ sách: thông tin sách và tiến độ. */
export interface RecentlyReadDto extends BookSummaryDto {
  percent: number | null; // 0–1; dữ liệu cũ null thì thẻ không hiện tiến độ.
  lastReadAt: number; // = progress.updatedAt
}

/**
 * Các đoạn văn của chương sau phân trang. Kiểu gốc nằm ở @marginalia/epub-parser.
 * Re-export tại đây cho renderer/preload dùng chung, tránh định nghĩa trùng và lệch kiểu.
 */
export type { ChapterTextSlice } from "@marginalia/epub-parser";

/**
 * Tham chiếu điều hướng chương để renderer liệt kê và lấy ID cho content.chapterText.
 * Chương dựa trên mục lục; level=0 là chương, từ 1 trở lên là các cấp mục con.
 * title chỉ có thể null khi EPUB không có mục lục và phải dùng đường dự phòng.
 */
export interface ChapterRefDto {
  id: string;
  title: string | null;
  href: string;
  anchor: string | null; // #fragment trong chương; null nếu không có anchor.
  orderIndex: number;
  level: number;
  startPage: number | null; // Trang bắt đầu chương PDF, đánh số từ 1; EPUB dùng null.
  endPage: number | null;
}

/** Trạng thái tóm tắt chương/sách được suy ra khi main đọc DB, không lưu trực tiếp. */
export type SummaryStatus = "pending" | "generating" | "ready" | "unavailable";

/** Kết quả content:chapter-summary: trạng thái và nội dung khi đã sẵn sàng. */
export interface ChapterSummaryDto {
  status: SummaryStatus;
  summary: string | null;
}

/**
 * Kết quả content:book-summary: trạng thái và nội dung tóm tắt toàn sách.
 * Main suy ra status khi đọc; bảng books chỉ lưu summary.
 */
export interface BookSummaryContentDto {
  status: SummaryStatus;
  summary: string | null;
}

/**
 * Hợp đồng trả về của library:read-book-bytes. Chỉ tệp bị thiếu trả ok:false.
 * Lỗi bất ngờ khác được handler ném ra để registry ghi nhận và renderer thấy query.isError.
 */
export type ReadBookBytesResult =
  | { ok: true; data: Uint8Array }
  | { ok: false; error: { reason: "missing" } };

export const exportAnnotatedPdfInput = z.object({
  bookId: z.string().min(1),
  bytes: z
    .instanceof(Uint8Array)
    .refine(
      (bytes) =>
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d,
      "Dữ liệu xuất không phải là tệp PDF hợp lệ.",
    ),
});
export type ExportAnnotatedPdfInput = z.infer<typeof exportAnnotatedPdfInput>;
export type ExportAnnotatedPdfResult = { status: "saved" | "canceled" };

/** Kết quả nối lại tệp sách: ok thành công, canceled do người dùng hủy, mismatch do chọn sai tệp. */
export type RelinkResult = { status: "ok" | "canceled" | "mismatch" };
