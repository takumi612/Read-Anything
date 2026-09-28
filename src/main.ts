import { app, BrowserWindow, net, shell } from "electron";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import started from "electron-squirrel-startup";
import { initDb, getDb } from "@main/db/instance";
import { initAppService } from "@main/app/app-service";
import { setModelFetch } from "@main/ai/model-factory";
import { getPreference } from "@main/preferences/repository";
import { initMainI18n } from "@main/i18n";
import { resolveInitialLanguage } from "@shared/i18n/language";
import { createLogger } from "@main/logger";
import { registerAppHandlers } from "@main/ipc/app-handlers";
import { registerLibraryHandlers } from "@main/ipc/library-handlers";
import { registerSettingsHandlers } from "@main/ipc/settings-handlers";
import { registerChatHandlers } from "@main/ipc/chat-handlers";
import { registerAiHandlers } from "@main/ipc/ai-handlers";
import { registerLogHandlers } from "@main/ipc/log-handlers";
import { registerAnnotationHandlers } from "@main/ipc/annotations-handlers";
import { registerBookNotesHandlers } from "@main/ipc/book-notes-handlers";
import { registerPreferenceHandlers } from "@main/ipc/preferences-handlers";
import { registerStatsHandlers } from "@main/ipc/stats-handlers";
import { registerBackupHandlers } from "@main/ipc/backup-handlers";
import { registerMemoryHandlers } from "@main/ipc/memory-handlers";
import { registerAgentHandlers } from "@main/ipc/agent-handlers";
import { registerReadingSessionHandlers } from "@main/ipc/reading-sessions-handlers";
import { registerVocabularyHandlers } from "@main/ipc/vocabulary-handlers";
import { closeLocalDictionary } from "@main/vocabulary/dictionary-store";
import { applyWindowsPdfAssociation } from "@main/app/windows-pdf-association";
import { initReadingClock, bindWindowToClock } from "@main/stats/clock-wiring";
import { registerCoverProtocol } from "@main/library/cover-protocol";
import { registerMediaProtocol } from "@main/media/media-protocol";
import { registerAppProtocolSchemes } from "@main/app/protocol-schemes";
import { startRendererServer, type RendererServer } from "@main/app/renderer-server";
import { maybeSeedSampleBook } from "@main/onboarding/seed-sample";
import { appService } from "@main/app";
import { C } from "@shared/ipc";

// Giữ dữ liệu từ bản Marginalia khi đổi tên; dev và bản phát hành vẫn tách riêng.
// Cần thiết lập trước lần đầu gọi app.getPath("userData").
if (!app.isPackaged) {
  app.setName(`${app.getName()}-dev`);
}
const legacyDataName = app.isPackaged ? "marginalia" : "marginalia-dev";
const legacyDataDir = path.join(app.getPath("appData"), legacyDataName);
if (!existsSync(app.getPath("userData")) && existsSync(legacyDataDir)) {
  app.setPath("userData", legacyDataDir);
}

// Đăng ký AppService tại ranh giới Electron; phần nghiệp vụ chỉ dùng giao diện appService.
// Thực hiện sau setName để dataDir theo đúng môi trường, trước các nơi sử dụng.
// Nếu khởi tạo lỗi, dừng ngay; các thành phần sau đó không cần xử lý trạng thái thiếu dịch vụ.
initAppService({
  dataDir: app.getPath("userData"),
  isDev: !app.isPackaged,
  openFolder: async (dir) => {
    await shell.openPath(dir); // Lỗi mở thư mục không làm ứng dụng dừng.
  },
});

const appLog = createLogger("app");
const windowLog = createLogger("window");
const dbLog = createLogger("db");

// Ghi lỗi chưa bắt được ở main process trước khi tiến trình dừng.
const processLog = createLogger("process");
process.on("uncaughtException", (err) => {
  processLog.error("uncaught exception", err);
  process.exit(1); // Dừng sau khi ghi lỗi, tránh tiếp tục với trạng thái sai.
});
process.on("unhandledRejection", (reason) => {
  processLog.error("unhandled rejection", reason);
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  const squirrelEvent = process.argv[1];
  const associationAction =
    squirrelEvent === "--squirrel-uninstall"
      ? "unregister"
      : squirrelEvent === "--squirrel-install" || squirrelEvent === "--squirrel-updated"
        ? "register"
        : null;
  if (process.platform === "win32" && associationAction) {
    const executablePath = process.execPath;
    const updateExePath = path.resolve(path.dirname(executablePath), "..", "Update.exe");
    try {
      applyWindowsPdfAssociation(
        associationAction,
        { executablePath, updateExePath },
        (args) => execFileSync("reg.exe", args, { windowsHide: true, stdio: "ignore" }),
        associationAction === "unregister",
      );
    } catch (error) {
      appLog.warn("Windows PDF association update failed", error);
    }
  }
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let rendererServer: RendererServer | null = null;
let pendingOpenPdf: string | null =
  process.argv.find((arg) => path.extname(arg).toLowerCase() === ".pdf") ?? null;

function dispatchOpenPdf(filePath: string): void {
  if (path.extname(filePath).toLowerCase() !== ".pdf") return;
  pendingOpenPdf = filePath;
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  const deliver = () => {
    if (pendingOpenPdf !== filePath || win.isDestroyed()) return;
    pendingOpenPdf = null;
    win.webContents.send(C.appOpenFile.channel, { filePath });
  };
  if (win.webContents.isLoading()) win.webContents.once("did-finish-load", deliver);
  else deliver();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const filePath = argv.find((arg) => path.extname(arg).toLowerCase() === ".pdf");
    if (filePath) dispatchOpenPdf(filePath);
    else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    dispatchOpenPdf(filePath);
  });
}

// Đăng ký các scheme tập trung một lần, trước app.ready.
registerAppProtocolSchemes();

function isExternalUrl(url: string): boolean {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

const createWindow = () => {
  // Create the browser window.
  const win = new BrowserWindow({
    // PDF reader opens with both the book sidebar and AI panel available; give the page enough
    // room for all three columns on first launch instead of mounting the reading pane at 0px.
    width: 1280,
    height: 850,
    // Keep the native Windows menu available with Alt, but hide its separator while reading.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // Keep packaged E2E runs rendering while the test runner takes foreground; normal launches
      // retain Electron's default background throttling.
      backgroundThrottling: !process.argv.includes("--e2e-unthrottled-pdf"),
    },
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      windowLog.error("renderer navigation failed", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    },
  );

  // and load the index.html of the app.
  const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? rendererServer?.url;
  if (!rendererUrl) {
    windowLog.error("renderer URL is unavailable");
    win.close();
    return;
  }
  void win.loadURL(rendererUrl).catch((err: unknown) => {
    windowLog.error("load renderer failed", err);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const isAppUrl = url.startsWith(rendererUrl);
    if (isAppUrl) return;
    event.preventDefault();
    if (isExternalUrl(url)) void shell.openExternal(url);
  });

  bindWindowToClock(win);

  // Open the DevTools.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }
  if (pendingOpenPdf) dispatchOpenPdf(pendingOpenPdf);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (!hasSingleInstanceLock) return;
  // Ghi mốc mỗi lần khởi động để phân biệt các phiên trong log.
  appLog.info(`Read-Anything ${app.getVersion()} started`);
  try {
    initDb();
  } catch (err) {
    dbLog.error("failed to initialize", err);
    app.quit();
    return;
  }
  // Main process đọc ngôn ngữ đã lưu; null sẽ dùng ngôn ngữ hệ thống.
  // Xác định một lần khi khởi động; i18n và sách mẫu dùng chung kết quả.
  const lang = resolveInitialLanguage(
    getPreference(getDb(), "language") ?? undefined,
    app.getLocale(),
  );
  initMainI18n(lang);
  // Yêu cầu AI đi qua proxy hệ thống: Electron net.fetch dùng mạng của Chromium.
  // Một số vùng chặn kết nối trực tiếp đến nhà cung cấp, nên cần tôn trọng proxy hệ thống.
  setModelFetch((input, init) => net.fetch(input instanceof URL ? input.toString() : input, init));
  registerCoverProtocol(); // Handler cover:// cần DB đã khởi tạo.
  registerMediaProtocol(); // Handler media:// cần DB đã khởi tạo.
  registerAppHandlers();
  registerLibraryHandlers();
  registerSettingsHandlers();
  registerChatHandlers();
  registerAnnotationHandlers();
  registerVocabularyHandlers();
  registerBookNotesHandlers();
  registerPreferenceHandlers();
  registerAgentHandlers();
  registerAiHandlers();
  registerLogHandlers();
  registerStatsHandlers();
  registerBackupHandlers();
  registerMemoryHandlers();
  registerReadingSessionHandlers();
  initReadingClock();
  // Nhập sách mẫu ở lần chạy đầu; thao tác lặp an toàn và hoàn tất trước khi tạo cửa sổ.
  await maybeSeedSampleBook(getDb(), lang, appService.getPath("booksDir"));
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    try {
      rendererServer = await startRendererServer(
        path.resolve(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`),
      );
    } catch (error) {
      windowLog.error("failed to start renderer server", error);
      app.quit();
      return;
    }
  }
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  closeLocalDictionary();
  if (rendererServer) {
    void rendererServer.close().catch((error: unknown) => {
      windowLog.warn("renderer server close failed", error);
    });
    rendererServer = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
