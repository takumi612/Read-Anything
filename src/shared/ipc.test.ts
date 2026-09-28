import { describe, expect, it } from "vitest";
import { appGetInfoResult, C, pingInput, pingResult, type Contract } from "@shared/ipc";

describe("ipc schemas", () => {
  it("exposes channel names", () => {
    expect(C.appGetInfo.channel).toBe("app:get-info");
    expect(C.ping.channel).toBe("ping");
  });

  it("ping input rejects non-string msg", () => {
    expect(pingInput.safeParse({ msg: 123 }).success).toBe(false);
    expect(pingInput.safeParse({ msg: "hi" }).success).toBe(true);
    expect(pingInput.safeParse({ msg: "" }).success).toBe(false);
  });

  it("ping result accepts an echo string", () => {
    expect(pingResult.safeParse({ echo: "hello" }).success).toBe(true);
  });

  it("app info result requires version + bookCount", () => {
    expect(
      appGetInfoResult.safeParse({ version: "1.0.0", bookCount: 0, platform: "win32" }).success,
    ).toBe(true);
    expect(appGetInfoResult.safeParse({ version: "1.0.0" }).success).toBe(false);
  });
});

describe("ipc contract map C", () => {
  const entries = Object.entries(C) as [string, Contract][];

  it("every channel string is unique", () => {
    const channels = entries.map(([, c]) => c.channel);
    expect(new Set(channels).size).toBe(channels.length);
  });

  it("every entry has a valid kind", () => {
    for (const [key, c] of entries) {
      expect(["invoke", "sync", "event"], `${key}`).toContain(c.kind);
    }
  });

  it("every entry carries an input Zod schema", () => {
    for (const [key, c] of entries) {
      expect(typeof c.input.safeParse, `${key}`).toBe("function");
    }
  });

  it("covers the known channels", () => {
    expect(C.libraryGet.channel).toBe("library:get");
    expect(C.aiChunk.kind).toBe("event");
    expect(C.preferencesGetAllSync.kind).toBe("sync");
  });

  it("constrains reader category clearing to a book and a supported category", () => {
    expect(
      C.readerClearBookCategory.input.safeParse({ bookId: "book-1", category: "annotations" })
        .success,
    ).toBe(true);
    expect(
      C.readerClearBookCategory.input.safeParse({ bookId: "book-1", category: "progress" })
        .success,
    ).toBe(false);
    expect(C.readerClearBookCategory.input.safeParse({ bookId: "", category: "notes" }).success)
      .toBe(false);
  });
});

describe("app:notify channel", () => {
  it("is declared as an event channel", () => {
    expect(C.appNotify.channel).toBe("app:notify");
    expect(C.appNotify.kind).toBe("event");
  });
});
