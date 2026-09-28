import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { appMeta } from "@main/db/schema";

/** Key trạng thái nội bộ, không gửi renderer; thêm key tại đây và kiểu tương ứng trong ValueMap. */
export type AppMetaKey = "sampleSeeded";

/** Kiểu giá trị của từng key trạng thái nội bộ. */
interface AppMetaValueMap {
  sampleSeeded: boolean;
}
type AppMetaValue<K extends AppMetaKey> = AppMetaValueMap[K];

/** Đọc trạng thái nội bộ; thiếu thì trả null. */
export function getAppMeta<K extends AppMetaKey>(db: DB, key: K): AppMetaValue<K> | null {
  const row = db.select().from(appMeta).where(eq(appMeta.key, key)).get();
  return row ? (row.value as AppMetaValue<K>) : null;
}

/** Ghi trạng thái nội bộ bằng upsert. */
export function setAppMeta<K extends AppMetaKey>(db: DB, key: K, value: AppMetaValue<K>): void {
  const now = Date.now();
  db.insert(appMeta)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: appMeta.key, set: { value, updatedAt: now } })
    .run();
}
