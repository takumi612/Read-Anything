import { z } from "zod";

/** UI chỉ hỗ trợ tiếng Việt và tiếng Anh; ngôn ngữ hệ thống khác sẽ dùng tiếng Anh. */
export const uiLanguage = z.enum(["vi", "en"]);
export type UILanguage = z.infer<typeof uiLanguage>;

/** Language metadata used by the language switcher and the document's lang/dir attributes. */
export const LANGS: { code: UILanguage; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "vi", label: "Tiếng Việt", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
];

/** System locale to supported language: vi* → vi, all others → en. */
export function matchSystemLanguage(locale: string): UILanguage {
  return /^vi(?:-|$)/i.test(locale) ? "vi" : "en";
}

/** On first launch, prefer the stored choice and otherwise match the system locale. */
export function resolveInitialLanguage(
  stored: UILanguage | undefined,
  systemLocale: string,
): UILanguage {
  return stored ?? matchSystemLanguage(systemLocale);
}
