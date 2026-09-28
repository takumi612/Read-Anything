import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { C } from "@shared/ipc";
import type { PreferencesSnapshot } from "@shared/preferences";
import type { AppOpenFilePayload } from "@shared/ipc";
import { createApi } from "./preload-api";

// Đọc đồng bộ snapshot tùy chọn một lần trước khung hình đầu để renderer khởi tạo theme-store.
// Thao tác thêm lớp .dark nằm ở src/renderer.tsx. Trong sandbox preload, document.documentElement
// có thể vẫn null; đụng vào DOM tại đây sẽ làm preload lỗi và contextBridge không được đăng ký.
const prefsSnapshot = ipcRenderer.sendSync(C.preferencesGetAllSync.channel) as PreferencesSnapshot;
const appLocale = ipcRenderer.sendSync(C.appGetLocaleSync.channel) as string;

// Buffer shell-open events until the React application subscribes; Windows can launch with a PDF
// before preload and renderer listeners have mounted.
let pendingOpenFile: string | null = null;
let openFileHandler: ((filePath: string) => void) | null = null;
ipcRenderer.on(C.appOpenFile.channel, (_event, payload: AppOpenFilePayload) => {
  if (openFileHandler) openFileHandler(payload.filePath);
  else pendingOpenFile = payload.filePath;
});

const api = createApi({
  invoke: (channel, input) => ipcRenderer.invoke(channel, input),
  sendSync: (channel, input) => ipcRenderer.sendSync(channel, input),
  on: (channel, cb) => {
    const listener = (_e: IpcRendererEvent, payload: unknown) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onOpenFile: (cb) => {
    openFileHandler = cb;
    const queued = pendingOpenFile;
    pendingOpenFile = null;
    if (queued) queueMicrotask(() => cb(queued));
    return () => {
      if (openFileHandler === cb) openFileHandler = null;
    };
  },
  getPathForFile: (file) => webUtils.getPathForFile(file),
  prefsSnapshot,
  appLocale,
});

contextBridge.exposeInMainWorld("api", api);

export type { RendererApi } from "./preload-api";
