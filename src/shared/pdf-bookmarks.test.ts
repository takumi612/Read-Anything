import { describe, expect, it } from "vitest";
import { createPdfBookmarkInput, renamePdfBookmarkInput } from "./pdf-bookmarks";

const bookmark = { bookId: "book-1", title: "Review the authorization flow", page: 12, scrollRatio: 0.3 };

describe("PDF bookmark notes", () => {
  it("requires a user-authored note when creating a bookmark", () => {
    expect(createPdfBookmarkInput.safeParse({ ...bookmark, title: "   " }).success).toBe(false);
    expect(createPdfBookmarkInput.safeParse(bookmark).success).toBe(true);
  });

  it("allows multiline bookmark notes up to 500 characters", () => {
    const title = "Line one\n" + "x".repeat(491);
    expect(createPdfBookmarkInput.safeParse({ ...bookmark, title }).success).toBe(true);
    expect(createPdfBookmarkInput.safeParse({ ...bookmark, title: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(renamePdfBookmarkInput.safeParse({ id: "bookmark-1", title }).success).toBe(true);
  });
});
