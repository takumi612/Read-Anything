import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type DB } from "@main/db/client";
import { books, readingPageVisits } from "@main/db/schema";
import { pageDailyTotals, recordPageRead } from "@main/stats/page-streak";

const MIGRATIONS = path.resolve(__dirname, "../db/migrations");

describe("reading page visits", () => {
  let db: DB;

  beforeEach(() => {
    db = createDb(":memory:");
    runMigrations(db, MIGRATIONS);
    db.insert(books).values({ id: "pdf-1", title: "PDF", format: "pdf" }).run();
  });

  it("counts a document page once per local day and returns the updated progress", () => {
    const input = { bookId: "pdf-1", pageNumber: 4, day: "2026-09-25" };
    recordPageRead(db, input);
    const progress = recordPageRead(db, input);

    expect(db.select().from(readingPageVisits).all()).toHaveLength(1);
    expect(pageDailyTotals(db)).toEqual([{ day: input.day, pages: 1 }]);
    expect(progress.pagesToday).toBe(1);
  });

  it("counts the same page again on a different day", () => {
    recordPageRead(db, { bookId: "pdf-1", pageNumber: 4, day: "2026-09-25" });
    recordPageRead(db, { bookId: "pdf-1", pageNumber: 4, day: "2026-09-26" });

    expect(pageDailyTotals(db)).toEqual([
      { day: "2026-09-25", pages: 1 },
      { day: "2026-09-26", pages: 1 },
    ]);
  });

  it("stores only the ten pages needed to light a day", () => {
    let progress = recordPageRead(db, { bookId: "pdf-1", pageNumber: 1, day: "2026-09-25" });
    for (let pageNumber = 2; pageNumber <= 20; pageNumber++) {
      progress = recordPageRead(db, { bookId: "pdf-1", pageNumber, day: "2026-09-25" });
    }

    expect(db.select().from(readingPageVisits).all()).toHaveLength(10);
    expect(pageDailyTotals(db)).toEqual([{ day: "2026-09-25", pages: 10 }]);
    expect(progress.pagesToday).toBe(10);
  });
});
