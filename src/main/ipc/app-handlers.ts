import { app, ipcMain, net, shell } from "electron";
import { C } from "@shared/ipc";
import { getDb } from "@main/db/instance";
import { getAppInfo, ping } from "@main/app-info";
import { bind, register, type Binding } from "@main/ipc/registry";
import { isAllowedExternalUrl } from "@main/app/external-url";
import { checkForUpdate } from "@main/app/update-check";
import { createLogger } from "@main/logger";
import { getWindowsPdfAssociationStatus } from "@main/app/windows-pdf-association";
import {
  resetApplicationBackground,
  storeApplicationBackground,
} from "@main/app/application-background";

const log = createLogger("app");

// net.fetch dùng proxy hệ thống; binding có kiểu nên không cần ép kiểu kết quả.
const netFetch: typeof fetch = (url, init) => net.fetch(url as string, init);

export const appBindings: Binding[] = [
  bind(C.ping, ping),
  bind(C.appGetInfo, () => getAppInfo(getDb(), app.getVersion())),
  bind(C.appPdfAssociationStatus, () => getWindowsPdfAssociationStatus()),
  bind(C.appResetBackground, () => resetApplicationBackground(getDb())),
  bind(C.appSetBackground, (bytes) => storeApplicationBackground(getDb(), bytes)),
  bind(C.appOpenExternal, (input) => {
    if (!isAllowedExternalUrl(input.url)) {
      log.warn(`refused to open external url with disallowed protocol: ${input.url}`);
      return;
    }
    void shell.openExternal(input.url);
  }),
  bind(C.appCheckUpdate, () => checkForUpdate(app.getVersion(), netFetch)),
];

export function registerAppHandlers(): void {
  register(appBindings);

  // Preload lấy locale hệ thống đồng bộ trước khung hình đầu để khởi tạo i18n.
  // Nếu app.getLocale lỗi, trả "en" để ứng dụng vẫn khởi động.
  ipcMain.on(C.appGetLocaleSync.channel, (e) => {
    try {
      e.returnValue = app.getLocale();
    } catch {
      e.returnValue = "en"; // Dùng tiếng Anh khi không đọc được locale hệ thống.
    }
  });
}
