import { copyFile, mkdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type { DB } from "@main/db/client";
import { createLogger } from "@main/logger";
import { webSearchConfig } from "@shared/web-search";
import {
  backupManifestSchema,
  type BackupKind,
  type BackupExportResult,
  type BackupInspection,
} from "@shared/backup";
import { buildManifest } from "@main/backup/manifest";
import { checkRestoreCompatibility } from "@main/backup/compat";
import { createBackupZip, extractZip, readZipEntryText, sha256File } from "@main/backup/archive";
import { applyRestore, verifyBookFiles, verifySqliteDatabase } from "@main/backup/restore";

const log = createLogger("backup");

/** Keep credentials out of portable archives, including plaintext keys from older app versions. */
function stripCredentialsFromSnapshot(snapshotPath: string): void {
  const snapshot = new Database(snapshotPath, { fileMustExist: true });
  try {
    // The archive includes only the .db file. Keep redaction writes out of a WAL sidecar.
    snapshot.pragma("journal_mode = DELETE");
    snapshot.transaction(() => {
      snapshot.prepare("UPDATE providers SET api_key = NULL WHERE api_key IS NOT NULL").run();
      const row = snapshot
        .prepare("SELECT value FROM preferences WHERE key = 'webSearch'")
        .get() as { value: string } | undefined;
      if (!row) return;
      let parsed: ReturnType<typeof webSearchConfig.safeParse>;
      try {
        parsed = webSearchConfig.safeParse(JSON.parse(row.value));
      } catch {
        parsed = webSearchConfig.safeParse(null);
      }
      if (!parsed.success) {
        snapshot.prepare("DELETE FROM preferences WHERE key = 'webSearch'").run();
        return;
      }
      const safeConfig = {
        backends: parsed.data.backends.map(({ apiKey: _apiKey, hasApiKey: _hasApiKey, ...backend }) =>
          backend,
        ),
      };
      snapshot
        .prepare("UPDATE preferences SET value = ? WHERE key = 'webSearch'")
        .run(JSON.stringify(safeConfig));
    })();
  } finally {
    snapshot.close();
  }
}

/** Xuất: tạo snapshot DB nhất quán, tính SHA-256, lập manifest, ZIP theo luồng rồi dọn tạm. */
export async function exportBackup(opts: {
  kind: BackupKind;
  createdAt: number;
  db: DB;
  rawSqlite: Database.Database;
  zipPath: string;
  booksDir: string;
  tmpDir: string;
  appVersion: string;
  schemaHead: string;
}): Promise<BackupExportResult> {
  await mkdir(opts.tmpDir, { recursive: true });
  const snapshotPath = path.join(opts.tmpDir, `export-${opts.createdAt}.db`);
  try {
    await opts.rawSqlite.backup(snapshotPath);
    stripCredentialsFromSnapshot(snapshotPath);
    const dbSha256 = await sha256File(snapshotPath);
    const manifest = buildManifest(opts.db, {
      kind: opts.kind,
      appVersion: opts.appVersion,
      schemaHead: opts.schemaHead,
      dbSha256,
      createdAt: opts.createdAt,
    });
    const archiveBase = {
      zipPath: opts.zipPath,
      snapshotPath,
      manifest,
    };
    await createBackupZip(
      opts.kind === "full"
        ? { ...archiveBase, kind: "full", booksDir: opts.booksDir }
        : { ...archiveBase, kind: "compact" },
    );
    return { path: opts.zipPath };
  } finally {
    await unlink(snapshotPath).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") log.warn("export temp cleanup failed", e);
    });
  }
}

/** Xem bản sao lưu: đọc manifest.json, kiểm tra bằng Zod và xác định tương thích. */
export async function inspectBackup(opts: {
  zipPath: string;
  knownMigrationDirs: string[];
}): Promise<BackupInspection> {
  const archiveSha256 = await sha256File(opts.zipPath);
  const raw = await readZipEntryText(opts.zipPath, "manifest.json");
  if (archiveSha256 !== (await sha256File(opts.zipPath))) {
    throw new Error("backup inspection refused: archive changed while being inspected");
  }
  const manifest = backupManifestSchema.parse(JSON.parse(raw));
  const { compatible, reason } = checkRestoreCompatibility(
    manifest.schemaHead,
    opts.knownMigrationDirs,
  );
  return { path: opts.zipPath, archiveSha256, manifest, compatible, reason };
}

/** Khôi phục: tách nguồn ZIP và payload, kiểm tra, đóng DB rồi thay snapshot; handler khởi động lại. */
export async function restoreBackup(opts: {
  zipPath: string;
  archiveSha256: string;
  dataDir: string;
  booksDir: string;
  tmpDir: string;
  preRestoreDir: string;
  dbFileName: string;
  knownMigrationDirs: string[];
  stamp: string;
  closeDb: () => void;
}): Promise<void> {
  const restoreRoot = path.join(opts.tmpDir, `restore-${opts.stamp}`);
  const sourceDir = path.join(restoreRoot, "source");
  const payloadDir = path.join(restoreRoot, "payload");
  await rm(restoreRoot, { recursive: true, force: true });
  await mkdir(sourceDir, { recursive: true });
  await mkdir(payloadDir, { recursive: true });
  try {
    const stagedArchive = path.join(sourceDir, "archive.zip");
    await copyFile(opts.zipPath, stagedArchive);
    if ((await sha256File(stagedArchive)) !== opts.archiveSha256) {
      throw new Error("restore refused: archive checksum changed since inspection");
    }
    await extractZip(stagedArchive, payloadDir);

    // Cần manifest và phiên bản schema đã biết.
    const manifestRaw = await readZipEntryText(stagedArchive, "manifest.json");
    const manifest = backupManifestSchema.parse(JSON.parse(manifestRaw));
    const compat = checkRestoreCompatibility(manifest.schemaHead, opts.knownMigrationDirs);
    if (!compat.compatible) throw new Error(`restore refused: ${compat.reason}`);

    // Kiểm tra hash DB, SQLite quick_check và đủ tệp sách với bản sao lưu đầy đủ.
    const stagedDb = path.join(payloadDir, opts.dbFileName);
    const stagedBooks = path.join(payloadDir, "books");
    const sha = await sha256File(stagedDb);
    if (sha !== manifest.dbSha256) {
      throw new Error("restore refused: backup database checksum mismatch (corrupt bundle)");
    }
    verifySqliteDatabase(stagedDb);
    if (manifest.kind === "full") {
      const books = verifyBookFiles(stagedDb, stagedBooks);
      if (!books.ok) {
        throw new Error(
          `restore refused: backup is missing book files: ${books.missing.join(", ")}`,
        );
      }
    }

    // Đóng kết nối để nhả khóa trước khi thay DB.
    const preRestoreTarget = path.join(opts.preRestoreDir, opts.stamp);
    opts.closeDb();
    try {
      await applyRestore({
        kind: manifest.kind,
        dataDir: opts.dataDir,
        booksDir: opts.booksDir,
        stagingDir: payloadDir,
        preRestoreTarget,
        dbFileName: opts.dbFileName,
      });
    } catch (err) {
      log.error("restore failed mid-swap", err);
      const detail = err instanceof Error ? err.message : "unknown file swap error";
      throw new Error(`Restore failed while swapping files. ${detail}`, { cause: err });
    }
  } finally {
    await rm(restoreRoot, { recursive: true, force: true }).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") log.warn("restore staging cleanup failed", e);
    });
  }
}
