import i18next from "i18next";
import { sharedInitOptions } from "@shared/i18n/resources";
import type { UILanguage } from "@shared/i18n/language";

// Main dùng i18next riêng, không phụ thuộc React, để dịch các thông điệp lỗi của ứng dụng.
const main = i18next.createInstance();

/** Khởi tạo đồng bộ theo ngôn ngữ đã chọn; gọi lại vẫn an toàn. */
export function initMainI18n(language: UILanguage): void {
  if (!main.isInitialized) {
    void main.init({ ...sharedInitOptions, lng: language });
  } else {
    void main.changeLanguage(language);
  }
}

/** Đổi ngôn ngữ của main khi tùy chọn người dùng thay đổi. */
export function setMainLanguage(language: UILanguage): void {
  void main.changeLanguage(language);
}

/** Hàm dịch của main với key đã được định kiểu. */
export const t = main.t.bind(main);
