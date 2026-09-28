import { describe, expect, it } from "vitest";
import { annotationStyle, createAnnotationInput } from "./annotations";

describe("annotation styles", () => {
  it("accepts persistent hex colors while keeping built-in styles compatible", () => {
    expect(annotationStyle.safeParse("yellow").success).toBe(true);
    expect(annotationStyle.safeParse("underline").success).toBe(true);
    expect(annotationStyle.safeParse("#fb923c").success).toBe(true);
    expect(annotationStyle.safeParse("#FB923C").success).toBe(true);
    expect(annotationStyle.safeParse("#f93").success).toBe(false);
    expect(annotationStyle.safeParse("red").success).toBe(false);
  });

  it("accepts a custom hex style through the annotation creation boundary", () => {
    expect(
      createAnnotationInput.safeParse({
        bookId: "book-1",
        style: "#fb923c",
        note: "",
        selectedText: "selected",
        locatorRange: "page=1&start=0&end=8",
      }).success,
    ).toBe(true);
  });
});
