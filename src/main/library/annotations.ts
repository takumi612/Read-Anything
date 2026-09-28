import { desc, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { annotations, books } from "@main/db/schema";
import type {
  AnnotationDto,
  AnnotationStyle,
  CreateAnnotationInput,
  UpdateAnnotationInput,
} from "@shared/annotations";

type AnnotationRow = typeof annotations.$inferSelect;

function toDto(row: AnnotationRow): AnnotationDto {
  return {
    id: row.id,
    bookId: row.bookId,
    style: row.style as AnnotationStyle,
    note: row.note,
    selectedText: row.selectedText,
    locatorRange: row.locatorRange,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Liệt kê annotation của sách theo thời gian tạo giảm dần. */
export function listAnnotationsByBook(db: DB, bookId: string): AnnotationDto[] {
  return db
    .select()
    .from(annotations)
    .where(eq(annotations.bookId, bookId))
    .orderBy(desc(annotations.createdAt))
    .all()
    .map(toDto);
}

/** Tạo annotation; sách không tồn tại thì báo lỗi dễ đọc. */
export function createAnnotation(db: DB, input: CreateAnnotationInput): AnnotationDto {
  const book = db.select({ id: books.id }).from(books).where(eq(books.id, input.bookId)).get();
  if (!book) throw new Error(`createAnnotation: book ${input.bookId} not found`);
  const row = db
    .insert(annotations)
    .values({
      bookId: input.bookId,
      style: input.style,
      note: input.note,
      selectedText: input.selectedText,
      locatorRange: input.locatorRange,
    })
    .returning()
    .get();
  return toDto(row);
}

/** Sửa màu/ghi chú của annotation; thiếu annotation thì báo lỗi. */
export function updateAnnotation(db: DB, input: UpdateAnnotationInput): AnnotationDto {
  const row = db
    .update(annotations)
    .set({ ...input.patch, updatedAt: Date.now() })
    .where(eq(annotations.id, input.id))
    .returning()
    .get();
  if (!row) throw new Error(`updateAnnotation: annotation ${input.id} not found`);
  return toDto(row);
}

/** Xóa annotation; gọi lặp không gây lỗi. */
export function deleteAnnotation(db: DB, id: string): void {
  db.delete(annotations).where(eq(annotations.id, id)).run();
}
