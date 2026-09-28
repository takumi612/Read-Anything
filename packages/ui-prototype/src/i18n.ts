import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { zh } from "#/locales/zh";
import { en } from "#/locales/en";
import { de } from "#/locales/de";

// Khởi tạo đồng bộ (tài nguyên được nhúng sẵn) → SSR và lần hiển thị đầu ở client cùng dùng zh; việc đổi ngôn ngữ chỉ diễn ra ở client, tránh lệch hydration.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      de: { translation: de },
    },
    lng: "zh",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export const LANGS = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const;

export default i18n;
