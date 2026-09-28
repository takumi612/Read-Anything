// Điểm Electron duy nhất để gửi thông báo từ main sang renderer.
import { BrowserWindow } from "electron";
import { C } from "@shared/ipc";
import type { AppNotification } from "@shared/chat";

/** Gửi thông báo tới các cửa sổ còn sống; bỏ qua cửa sổ đã bị hủy. */
export function notifyRenderer(n: AppNotification): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(C.appNotify.channel, n);
  }
}
