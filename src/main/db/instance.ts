import { appService } from "@main/app";
import { createDb, runMigrations, type DB } from "@main/db/client";
import { resolveMigrationsFolder } from "@main/db/migrations-path";
import { ensureBuiltinProviders } from "@main/providers/default-providers";
import { migrateProviderApiKeys } from "@main/providers/repository";
import { migrateWebSearchApiKeys } from "@main/preferences/repository";
import { createLogger } from "@main/logger";

const log = createLogger("db");

let db: DB | undefined;

export function initDb(): DB {
  if (db) return db;
  const dbPath = appService.getPath("dbFile");
  const candidate = createDb(dbPath);
  log.info("running db migrations");
  runMigrations(candidate, resolveMigrationsFolder());
  log.info("db ready");
  migrateProviderApiKeys(candidate);
  migrateWebSearchApiKeys(candidate);
  ensureBuiltinProviders(candidate);
  db = candidate;
  return db;
}

export function getDb(): DB {
  if (!db) throw new Error("DB not initialized");
  return db;
}

/** Đóng SQLite, flush WAL và nhả khóa trước khi thay DB lúc khôi phục. */
export function closeDb(): void {
  db?.$client.close();
  db = undefined;
}
