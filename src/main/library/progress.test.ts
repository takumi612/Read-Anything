import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "@main/db/client";
import { progress } from "@main/db/schema";
import { importBook } from "@main/library/repository";
import {
  confirmProgressPage,
  getConfirmedProgress,
  getProgress,
  saveProgress,
} from "@main/library/progress";
import { makeFixtureEpub } from "@marginalia/epub-parser";

const MIGRATIONS = path.resolve(__dirname, "../db/migrations");
const setup = async () => {
  const db = createDb(":memory:");
  runMigrations(db, MIGRATIONS);
  const book = await importBook(db, { bytes: makeFixtureEpub() });
  return { db, book };
};

describe("progress repository", () => {
  it("returns undefined when nothing saved", async () => {
    const { db, book } = await setup();
    expect(getProgress(db, book.id)).toBeUndefined();
  });
  it("upserts locator", async () => {
    const { db, book } = await setup();
    saveProgress(db, book.id, "epubcfi(/6/2!/4/1:0)");
    expect(getProgress(db, book.id)?.locator).toBe("epubcfi(/6/2!/4/1:0)");
    saveProgress(db, book.id, "epubcfi(/6/4!/4/1:0)");
    expect(getProgress(db, book.id)?.locator).toBe("epubcfi(/6/4!/4/1:0)");
  });

  it("updates completion from unique confirmed pages and never decreases when revisiting", async () => {
    const { db, book } = await setup();
    expect(confirmProgressPage(db, book.id, 4, 20)).toEqual({ confirmedPages: 1, percent: 0.05 });
    expect(confirmProgressPage(db, book.id, 2, 20)).toEqual({ confirmedPages: 2, percent: 0.1 });
    expect(confirmProgressPage(db, book.id, 4, 20)).toEqual({ confirmedPages: 2, percent: 0.1 });
    expect(confirmProgressPage(db, book.id, 1, 20)).toEqual({ confirmedPages: 3, percent: 0.15 });
  });

  it("keeps a legacy completion percentage as the floor for confirmed pages", async () => {
    const { db, book } = await setup();
    saveProgress(db, book.id, "epubcfi(/6/2!/4/1:0)");
    db.update(progress).set({ percent: 0.4 }).run();

    expect(confirmProgressPage(db, book.id, 1, 100)).toEqual({
      confirmedPages: 1,
      percent: 0.4,
    });
  });

  it("keeps confirmed completion separate when saving a newer locator", async () => {
    const { db, book } = await setup();
    expect(confirmProgressPage(db, book.id, 2, 4).percent).toBe(0.25);
    saveProgress(db, book.id, "epubcfi(/6/4!/4/1:0)");
    expect(getConfirmedProgress(db, book.id)?.percent).toBe(0.25);
    expect(getProgress(db, book.id)).toMatchObject({
      locator: "epubcfi(/6/4!/4/1:0)",
      percent: null,
    });
  });

  it("rejects page numbers beyond the total", async () => {
    const { db, book } = await setup();
    expect(() => confirmProgressPage(db, book.id, 5, 4)).toThrow(/between 1 and totalPages/);
  });
});
