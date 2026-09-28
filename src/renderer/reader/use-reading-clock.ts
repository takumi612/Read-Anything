import { useEffect } from "react";
import { createLogger } from "@renderer/logger";
import { useSettingsStore } from "@renderer/store/settings-store";

const log = createLogger("stats");

/** Báo trạng thái đọc cho main process khi vào hoặc rời trình đọc; hộp cài đặt che trình đọc thì báo null.
 * Main process theo dõi focus và nguồn điện, hook này chỉ theo dõi khả năng nhìn thấy trình đọc. */
export function useReadingClock(bookId: string | null): void {
  const settingsOpen = useSettingsStore((s) => s.open);
  useEffect(() => {
    const target = bookId != null && !settingsOpen ? bookId : null;
    void window.api.stats
      .readingState(target ? { status: "active", bookId: target } : { status: "idle" })
      .catch((err: unknown) => log.warn("reading-state report failed", err));
  }, [bookId, settingsOpen]);
  // Khi tháo hook và rời trình đọc, đặt lại null.
  useEffect(
    () => () => {
      void window.api.stats
        .readingState({ status: "idle" })
        .catch((err: unknown) => log.warn("reading-state cleanup failed", err));
    },
    [],
  );
}
