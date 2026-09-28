import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { v7 as uuidv7 } from "uuid";
import * as schema from "@main/db/schema";

export type DB = BetterSQLite3Database<typeof schema> & { $client: InstanceType<typeof Database> };
export type DBTransaction = Omit<DB, "$client">;

const LEGACY_READING_SESSIONS_STAGING = "__marginalia_legacy_reading_sessions";

/** Internal migration fault-injection seam used by recovery tests; production callers omit it. */
export interface RunMigrationsHooks {
  afterLegacyReadingSessionsStaged?: () => void;
  afterMigrationDdl?: () => void;
  afterLegacyReadingSessionInsert?: () => void;
}

function tableExists(db: DB, table: string): boolean {
  return Boolean(
    db.$client.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

function columnExists(db: DB, table: string, column: string): boolean {
  return db.$client
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => (row as { name: string }).name === column);
}

interface LegacyReadingSessionCandidate {
  bookId: string;
  isFinished: number;
  addedAt: number | null;
}

interface LegacyReadingEvidence {
  firstMessageAt: number | null;
  fallbackStartedAt: number | null;
  lastEvidenceAt: number | null;
}

function hasColumns(db: DB, table: string, columns: string[]): boolean {
  return columns.every((column) => columnExists(db, table, column));
}

function collectLegacyReadingEvidence(db: DB): Map<string, LegacyReadingEvidence> {
  const evidence = new Map<string, LegacyReadingEvidence>();
  const record = (bookId: string | null, timestamp: number | null, isMessage = false): void => {
    if (bookId == null) return;
    const current = evidence.get(bookId) ?? {
      firstMessageAt: null,
      fallbackStartedAt: null,
      lastEvidenceAt: null,
    };
    if (timestamp != null) {
      if (isMessage) {
        current.firstMessageAt = Math.min(current.firstMessageAt ?? timestamp, timestamp);
      }
      if (!isMessage) {
        current.fallbackStartedAt = Math.min(current.fallbackStartedAt ?? timestamp, timestamp);
      }
      current.lastEvidenceAt = Math.max(current.lastEvidenceAt ?? timestamp, timestamp);
    }
    evidence.set(bookId, current);
  };
  const recordRows = (query: string, isMessage = false): void => {
    for (const row of db.$client.prepare(query).all() as Array<{
      bookId: string | null;
      timestamp: number | null;
    }>) {
      record(row.bookId, row.timestamp, isMessage);
    }
  };

  if (
    tableExists(db, "messages") &&
    tableExists(db, "conversations") &&
    hasColumns(db, "messages", ["conversation_id", "created_at"]) &&
    hasColumns(db, "conversations", ["id", "book_id"])
  ) {
    recordRows(
      `SELECT conversations.book_id AS bookId, messages.created_at AS timestamp
       FROM messages INNER JOIN conversations ON conversations.id = messages.conversation_id`,
      true,
    );
  }
  if (tableExists(db, "progress") && hasColumns(db, "progress", ["book_id", "updated_at"])) {
    recordRows("SELECT book_id AS bookId, updated_at AS timestamp FROM progress");
  }
  if (
    tableExists(db, "annotations") &&
    hasColumns(db, "annotations", ["book_id", "created_at", "updated_at"])
  ) {
    recordRows("SELECT book_id AS bookId, created_at AS timestamp FROM annotations");
    recordRows("SELECT book_id AS bookId, updated_at AS timestamp FROM annotations");
  }
  if (
    tableExists(db, "book_notes") &&
    hasColumns(db, "book_notes", ["book_id", "created_at", "updated_at"])
  ) {
    recordRows("SELECT book_id AS bookId, created_at AS timestamp FROM book_notes");
    recordRows("SELECT book_id AS bookId, updated_at AS timestamp FROM book_notes");
  }
  if (
    tableExists(db, "conversations") &&
    hasColumns(db, "conversations", ["book_id", "created_at", "updated_at"])
  ) {
    recordRows("SELECT book_id AS bookId, created_at AS timestamp FROM conversations");
    recordRows("SELECT book_id AS bookId, updated_at AS timestamp FROM conversations");
  }
  if (tableExists(db, "reading_daily") && hasColumns(db, "reading_daily", ["book_id", "day"])) {
    recordRows(
      "SELECT book_id AS bookId, CAST(strftime('%s', day) AS INTEGER) * 1000 AS timestamp FROM reading_daily",
    );
  }
  return evidence;
}

function stageLegacyReadingSessions(db: DB): void {
  if (tableExists(db, LEGACY_READING_SESSIONS_STAGING)) return;
  if (!tableExists(db, "books") || tableExists(db, "reading_sessions")) return;

  const hasIsFinished = columnExists(db, "books", "is_finished");
  const hasAddedAt = columnExists(db, "books", "added_at");
  const candidates = db.$client
    .prepare(
      hasIsFinished && hasAddedAt
        ? "SELECT id AS bookId, is_finished AS isFinished, added_at AS addedAt FROM books"
        : hasIsFinished
          ? "SELECT id AS bookId, is_finished AS isFinished, NULL AS addedAt FROM books"
          : hasAddedAt
            ? "SELECT id AS bookId, 0 AS isFinished, added_at AS addedAt FROM books"
            : "SELECT id AS bookId, 0 AS isFinished, NULL AS addedAt FROM books",
    )
    .all() as LegacyReadingSessionCandidate[];
  const evidence = collectLegacyReadingEvidence(db);
  if (evidence.size === 0) return;

  const create = db.$client.prepare(`
    CREATE TABLE ${LEGACY_READING_SESSIONS_STAGING} (
      book_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      is_finished INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);
  db.$client.transaction(() => {
    create.run();
    const insert = db.$client.prepare(`
      INSERT INTO ${LEGACY_READING_SESSIONS_STAGING}
        (book_id, session_id, is_finished, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const candidate of candidates) {
      const readingEvidence = evidence.get(candidate.bookId);
      if (readingEvidence == null) continue;
      const startedAt =
        readingEvidence.firstMessageAt ?? readingEvidence.fallbackStartedAt ?? candidate.addedAt;
      if (startedAt == null) continue;
      insert.run(
        candidate.bookId,
        uuidv7(),
        candidate.isFinished,
        startedAt,
        candidate.isFinished
          ? Math.max(startedAt, readingEvidence.lastEvidenceAt ?? startedAt)
          : null,
      );
    }
  })();
}

function applyStagedLegacyReadingSessions(db: DB, hooks: RunMigrationsHooks | undefined): void {
  if (!tableExists(db, LEGACY_READING_SESSIONS_STAGING)) return;
  if (
    !tableExists(db, "reading_sessions") ||
    !columnExists(db, "reading_daily", "reading_session_id")
  ) {
    return;
  }
  db.$client.transaction(() => {
    db.$client
      .prepare(`
      INSERT INTO reading_sessions (id, book_id, started_at, completed_at)
      SELECT staged.session_id, staged.book_id, staged.started_at, staged.completed_at
      FROM ${LEGACY_READING_SESSIONS_STAGING} AS staged
      WHERE NOT EXISTS (SELECT 1 FROM reading_sessions WHERE id = staged.session_id)
    `)
      .run();
    hooks?.afterLegacyReadingSessionInsert?.();
    db.$client
      .prepare(`
      UPDATE reading_daily
      SET reading_session_id = (
        SELECT staged.session_id
        FROM ${LEGACY_READING_SESSIONS_STAGING} AS staged
        WHERE staged.book_id = reading_daily.book_id
      )
      WHERE reading_session_id IS NULL
        AND EXISTS (
          SELECT 1 FROM ${LEGACY_READING_SESSIONS_STAGING} AS staged
          WHERE staged.book_id = reading_daily.book_id
        )
    `)
      .run();
    db.$client.prepare(`DROP TABLE ${LEGACY_READING_SESSIONS_STAGING}`).run();
  })();
}

/** Mở/tạo SQLite với WAL và khóa ngoại, trả Drizzle instance; dùng :memory: khi kiểm thử. */
export function createDb(filename: string): DB {
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle({ client: sqlite, schema });
}

/**
 * Áp dụng migration do drizzle-kit tạo.
 *
 * Tắt kiểm tra khóa ngoại trước transaction migration, rồi bật lại sau.
 * drizzle migrate chạy trong BEGIN…COMMIT; SQLite không đổi PRAGMA foreign_keys
 * khi đang trong transaction. Migration dựng lại bảng có DROP bảng cũ sẽ lỗi
 * SQLITE_CONSTRAINT_FOREIGNKEY nếu bảng con còn tham chiếu.
 * Đổi PRAGMA bên ngoài transaction giúp migration chạy, sau đó kiểm tra lại quan hệ.
 */
export function runMigrations(db: DB, migrationsFolder: string, hooks?: RunMigrationsHooks): void {
  stageLegacyReadingSessions(db);
  hooks?.afterLegacyReadingSessionsStaged?.();
  db.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    migrate(db, { migrationsFolder });
  } finally {
    db.run(sql`PRAGMA foreign_keys = ON`);
  }
  hooks?.afterMigrationDdl?.();
  applyStagedLegacyReadingSessions(db, hooks);
}
