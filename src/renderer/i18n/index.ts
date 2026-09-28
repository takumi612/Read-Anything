// Singleton i18next của renderer đọc đồng bộ window.api khi module được nạp để chọn ngôn ngữ khởi động.
// Chỉ import module này trong renderer; kiểm thử không có UI sẽ thiếu window.api và lỗi.
// Khi cần kiểm thử, import trễ bằng await import("@renderer/i18n") hoặc mock window.api.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { sharedInitOptions } from "@shared/i18n/resources";
import { LANGS, resolveInitialLanguage, type UILanguage } from "@shared/i18n/language";
import { persistPreference } from "@renderer/store/persist-preference";

/** Đặt lang và dir trên html theo ngôn ngữ; dir lấy từ LANGS để hỗ trợ ngôn ngữ RTL sau này. */
function applyHtmlDir(code: UILanguage): void {
  const lang = LANGS.find((l) => l.code === code) ?? LANGS[0];
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir;
}

const initial = resolveInitialLanguage(
  window.api.preferences.getAll().language,
  window.api.app.locale,
);

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    ...sharedInitOptions,
    lng: initial,
    react: { useSuspense: false },
  });
}
applyHtmlDir(initial);

/** Đổi ngôn ngữ giao diện trong i18next, lưu tùy chọn và cập nhật dir trên html. */
export function changeUiLanguage(code: UILanguage): void {
  void i18n.changeLanguage(code);
  persistPreference({ key: "language", value: code });
  applyHtmlDir(code);
}

export default i18n;
