import { describe, expect, it } from "vitest";
import { vocabularyLookupInput } from "@shared/vocabulary";

const lookupInput = (term: string) =>
  vocabularyLookupInput.safeParse({
    bookId: "book-1",
    term,
    context: "A technical passage.",
    sourcePage: 1,
  });

describe("vocabulary lookup selection", () => {
  it("accepts short technical phrases and programming language names", () => {
    expect(lookupInput("machine learning").success).toBe(true);
    expect(lookupInput("distributed systems design").success).toBe(true);
    expect(lookupInput("C++").success).toBe(true);
    expect(lookupInput(".NET").success).toBe(true);
    expect(lookupInput("CI/CD").success).toBe(true);
  });

  it("rejects sentence selections and phrases longer than four words", () => {
    expect(lookupInput("What does a microservice do?").success).toBe(false);
    expect(lookupInput("natural language processing system architecture").success).toBe(false);
  });
});
