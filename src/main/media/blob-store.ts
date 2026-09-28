import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { DB } from "@main/db/client";
import { blob } from "@main/db/schema";

/** Lưu bytes và MIME của blob, trả ID mới; bên gọi nhận diện MIME khi ghi. */
export function writeBlob(db: DB, data: Uint8Array, mimeType: string): string {
  const id = uuidv7();
  db.insert(blob)
    .values({ id, data: Buffer.from(data), mimeType, createdAt: Date.now() })
    .run();
  return id;
}

/** Xóa blob; ID không tồn tại không gây lỗi. */
export function deleteBlob(db: DB, id: string): void {
  db.delete(blob).where(eq(blob.id, id)).run();
}

/** Lấy bytes và MIME cho media://; ID không tồn tại trả null. */
export function blobResponseFor(
  db: DB,
  id: string,
): { bytes: Uint8Array; contentType: string } | null {
  const row = db
    .select({ data: blob.data, mimeType: blob.mimeType })
    .from(blob)
    .where(eq(blob.id, id))
    .get();
  if (!row?.data) return null;
  return { bytes: new Uint8Array(row.data), contentType: row.mimeType };
}
