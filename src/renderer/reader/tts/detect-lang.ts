/** Nhóm ngôn ngữ thô để chọn giọng TTS; không cần nhận diện chi tiết hơn. */
export type TtsLang = "zh" | "ja" | "en" | "vi";

/**
 * Nhận diện ngôn ngữ từng đoạn qua số ký tự kana, chữ Hán và dấu tiếng Việt.
 * Kana là dấu hiệu mạnh của tiếng Nhật nên ngưỡng thấp đã chọn ja.
 * Nếu chữ Hán chiếm hơn 30% thì chọn zh, cho phép đoạn tiếng Trung có thuật ngữ Latin;
 * trường hợp khác về en.
 */
export function detectParagraphLang(text: string): TtsLang {
  let cjk = 0;
  let kana = 0;
  let total = 0;
  for (const ch of text) {
    if (!/[\p{L}\p{N}]/u.test(ch)) continue;
    total++;
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x3040 && cp <= 0x30ff) kana++;
    else if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf)) cjk++;
  }
  if (total === 0) return "en";
  if (kana / total > 0.05) return "ja";

  // Vietnamese uses several distinctive Latin letters. For short phrases without those letters,
  // multiple tone marks across a substantial Latin passage distinguish Vietnamese from an
  // occasional accent in English (for example, “café”). Normalize so decomposed accents count too.
  const normalized = text.normalize("NFC").toLocaleLowerCase("vi");
  if (/[ăđơư]/u.test(normalized)) return "vi";
  let latinLetters = 0;
  let diacriticMarks = 0;
  for (const ch of normalized.normalize("NFD")) {
    if (/\p{L}/u.test(ch) && /\p{Script=Latin}/u.test(ch)) latinLetters++;
    else if (/\p{M}/u.test(ch)) diacriticMarks++;
  }
  if (latinLetters >= 8 && diacriticMarks >= 2 && diacriticMarks / latinLetters >= 0.15) {
    return "vi";
  }

  if (cjk / total > 0.3) return "zh";
  return "en";
}
