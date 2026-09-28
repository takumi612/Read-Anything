import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "@main/db/client";
import { blob } from "@main/db/schema";
import { getPreference } from "@main/preferences/repository";
import { APPLICATION_BACKGROUND_MAX_BYTES } from "@shared/app-background";
import { resetApplicationBackground, storeApplicationBackground } from "./application-background";

const MIGRATIONS = path.resolve(__dirname, "../db/migrations");
function freshDb() {
  const db = createDb(":memory:");
  runMigrations(db, MIGRATIONS);
  return db;
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TXT = new Uint8Array([0x68, 0x69]);

describe("application-background", () => {
  it("stores an image locally and selects image mode", () => {
    const db = freshDb();
    const result = storeApplicationBackground(db, PNG);
    expect(result.status).toBe("set");
    const id = result.status === "set" ? result.blobId : "";
    expect(getPreference(db, "appBackgroundBlobId")).toBe(id);
    expect(getPreference(db, "appBackgroundMode")).toBe("image");
    expect(db.select().from(blob).all()).toHaveLength(1);
  });

  it("rejects files over the size limit and unsupported bytes", () => {
    const db = freshDb();
    const big = new Uint8Array(APPLICATION_BACKGROUND_MAX_BYTES + 1);
    big.set(PNG);
    expect(storeApplicationBackground(db, big).status).toBe("too-large");
    expect(storeApplicationBackground(db, TXT).status).toBe("unsupported");
    expect(db.select().from(blob).all()).toHaveLength(0);
  });

  it("replaces the previous image without leaving an orphan", () => {
    const db = freshDb();
    storeApplicationBackground(db, PNG);
    const replacement = storeApplicationBackground(db, PNG);
    const id = replacement.status === "set" ? replacement.blobId : "";
    expect(getPreference(db, "appBackgroundBlobId")).toBe(id);
    expect(db.select().from(blob).all()).toHaveLength(1);
  });

  it("reset removes the stored image and returns to the default mode", () => {
    const db = freshDb();
    storeApplicationBackground(db, PNG);
    resetApplicationBackground(db);
    expect(getPreference(db, "appBackgroundBlobId")).toBeNull();
    expect(getPreference(db, "appBackgroundMode")).toBe("default");
    expect(db.select().from(blob).all()).toHaveLength(0);
  });
});
