import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type DB } from "@main/db/client";

const MIGRATIONS = path.resolve(__dirname, "migrations");
const PREVIOUS_MIGRATION = "20260925070227_famous_hammerhead";
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function migrationsThrough(destination: string, lastMigration: string): string {
  fs.mkdirSync(destination);
  for (const entry of fs.readdirSync(MIGRATIONS, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name <= lastMigration) {
      fs.cpSync(path.join(MIGRATIONS, entry.name), path.join(destination, entry.name), {
        recursive: true,
      });
    }
  }
  return destination;
}

function insertBook(db: DB): void {
  db.run(sql`
    INSERT INTO books (id, title, author, format, has_text_layer, added_at, position, parser_version)
    VALUES ('color-migration-book', 'Book', 'Author', 'epub', 1, 1, 0, 0)
  `);
}

describe("custom annotation color migration", () => {
  it("preserves existing annotations and accepts custom hex colors", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "marginalia-annotation-colors-"));
    temporaryDirectories.push(directory);
    const db = createDb(path.join(directory, "marginalia.db"));

    try {
      runMigrations(db, migrationsThrough(path.join(directory, "previous-migrations"), PREVIOUS_MIGRATION));
      insertBook(db);
      db.run(sql`
        INSERT INTO annotations (id, book_id, style, selected_text, locator_range, created_at, updated_at)
        VALUES ('existing-highlight', 'color-migration-book', 'yellow', 'existing', 'epubcfi(/6/2)', 2, 3)
      `);

      runMigrations(db, MIGRATIONS);
      db.run(sql`
        INSERT INTO annotations (id, book_id, style, selected_text, locator_range, created_at, updated_at)
        VALUES ('custom-highlight', 'color-migration-book', '#19a974', 'custom', 'epubcfi(/6/4)', 4, 5)
      `);

      expect(
        db.all<{ id: string; style: string; selected_text: string }>(sql`
          SELECT id, style, selected_text FROM annotations ORDER BY id
        `),
      ).toEqual([
        { id: "custom-highlight", style: "#19a974", selected_text: "custom" },
        { id: "existing-highlight", style: "yellow", selected_text: "existing" },
      ]);
    } finally {
      db.$client.close();
    }
  });
});
