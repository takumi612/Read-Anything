import type { InitOptions } from "i18next";
import vi from "./locales/vi";
import en from "./locales/en";

/** Tài nguyên i18next dùng chung cho hai tiến trình; key ngôn ngữ theo BCP 47. */
export const resources = {
  vi: { translation: vi },
  en: { translation: en },
} as const;

/**
 * Cấu hình chung để main và renderer khởi tạo i18next nhất quán.
 * Tắt keySeparator/nsSeparator để `errors.foo` là một key phẳng, dễ tìm trong source.
 * Bên gọi thêm lng và renderer thêm tùy chọn React.
 */
export const sharedInitOptions: InitOptions = {
  resources,
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
};
