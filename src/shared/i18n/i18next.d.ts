import "i18next";
import type vi from "./locales/vi";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    // Key phẳng như errors.foo được dùng nguyên chuỗi, khớp sharedInitOptions.
    keySeparator: false;
    resources: { translation: typeof vi };
  }
}
