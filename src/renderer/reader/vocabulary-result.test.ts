import { describe, expect, it } from "vitest";
import { parseVocabularyResult } from "./vocabulary-result";

describe("parseVocabularyResult", () => {
  it("separates pronunciation, sense labels, definitions, and examples", () => {
    expect(
      parseVocabularyResult(
        "/ˈtoʊkən/ (US) · /ˈtəʊkən/ (UK)\n1. [AI/ML] [danh từ] đơn vị văn bản được xử lý\n   The tokenizer returns a token.\n2. [động từ] chuyển nội dung thành token",
      ),
    ).toEqual({
      baseForm: null,
      pronunciation: "/ˈtoʊkən/ (US) · /ˈtəʊkən/ (UK)",
      senses: [
        {
          domain: "AI/ML",
          partOfSpeech: "danh từ",
          meaning: "đơn vị văn bản được xử lý",
          example: "The tokenizer returns a token.",
        },
        {
          domain: null,
          partOfSpeech: "động từ",
          meaning: "chuyển nội dung thành token",
          example: null,
        },
      ],
      plainText: null,
    });
  });

  it("keeps user-written translations as plain text", () => {
    expect(parseVocabularyResult("bản dịch do người dùng lưu")).toEqual({
      baseForm: null,
      pronunciation: null,
      senses: [],
      plainText: "bản dịch do người dùng lưu",
    });
  });

  it("parses the dictionary base-form label separately from pronunciation and meanings", () => {
    expect(
      parseVocabularyResult(
        "@base: centralize\n/ˈsɛntrəlaɪzd/\n1. [động từ] quá khứ của centralize\n2. [động từ] tập trung vào một trung tâm",
      ),
    ).toEqual({
      baseForm: "centralize",
      pronunciation: "/ˈsɛntrəlaɪzd/",
      senses: [
        {
          domain: null,
          partOfSpeech: "động từ",
          meaning: "quá khứ của centralize",
          example: null,
        },
        {
          domain: null,
          partOfSpeech: "động từ",
          meaning: "tập trung vào một trung tâm",
          example: null,
        },
      ],
      plainText: null,
    });
  });
});
