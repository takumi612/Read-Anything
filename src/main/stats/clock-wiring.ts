import { app, powerMonitor, type BrowserWindow } from "electron";
import { getDb } from "@main/db/instance";
import { createReadingClock, type ReadingClock } from "@main/stats/clock";
import { localDayKey } from "@main/stats/day-key";
import { addSeconds } from "@main/stats/reading-daily";
import { createLogger } from "@main/logger";
import { getActiveReadingSession } from "@main/reading-sessions/repository";

const log = createLogger("stats");

/** Chu kỳ lưu thời gian; crash có thể mất tối đa một chu kỳ, qua nửa đêm tính lại ngày. */
const FLUSH_INTERVAL_MS = 60_000;

let clock: ReadingClock | null = null;

/** Tay cầm đồng hồ đọc cho IPC handler. */
export function getReadingClock(): ReadingClock {
  if (!clock) throw new Error("reading clock not initialized");
  return clock;
}

/** Gọi một lần sau app.ready để tạo đồng hồ, nghe powerMonitor và lưu theo chu kỳ. */
export function initReadingClock(): void {
  if (clock) return;
  clock = createReadingClock({
    now: () => Date.now(),
    commit: (bookId, atMs, seconds) => {
      try {
        const db = getDb();
        const session = getActiveReadingSession(db, bookId);
        if (!session) {
          log.warn(`dropping reading time without active session for book ${bookId}`);
          return;
        }
        addSeconds(db, { bookId, readingSessionId: session.id, day: localDayKey(atMs), seconds });
      } catch (err) {
        log.warn("commit reading time failed", err);
      }
    },
  });
  clock.setAwake(true);
  powerMonitor.on("suspend", () => clock?.setAwake(false));
  powerMonitor.on("resume", () => clock?.setAwake(true));
  powerMonitor.on("lock-screen", () => clock?.setAwake(false)); // suspend là đường dự phòng.
  powerMonitor.on("unlock-screen", () => clock?.setAwake(true));
  const interval = setInterval(() => clock?.tick(), FLUSH_INTERVAL_MS);
  app.on("before-quit", () => {
    clearInterval(interval);
    clock?.tick();
  });
}

/** Gắn sự kiện focus của cửa sổ; reload/đóng sẽ xóa sách đang đọc. */
export function bindWindowToClock(win: BrowserWindow): void {
  const c = getReadingClock();
  c.setFocused(win.isFocused());
  win.on("focus", () => c.setFocused(true));
  win.on("blur", () => c.setFocused(false));
  win.webContents.on("did-finish-load", () => c.setReadingBook(null));
  win.on("closed", () => c.setReadingBook(null));
}
