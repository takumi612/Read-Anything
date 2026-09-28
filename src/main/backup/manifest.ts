import { count } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { books } from "@main/db/schema";
import { BACKUP_FORMAT_VERSION, type BackupKind, type BackupManifest } from "@shared/backup";

/** Lập manifest sao lưu; đọc bookCount, các trường còn lại do lớp điều phối truyền vào. */
export function buildManifest(
  db: DB,
  opts: {
    kind: BackupKind;
    appVersion: string;
    schemaHead: string;
    dbSha256: string;
    createdAt: number;
  },
): BackupManifest {
  const [{ c }] = db.select({ c: count() }).from(books).all();
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    kind: opts.kind,
    appVersion: opts.appVersion,
    schemaHead: opts.schemaHead,
    createdAt: opts.createdAt,
    bookCount: c,
    includesApiKeys: true,
    dbSha256: opts.dbSha256,
  };
}
