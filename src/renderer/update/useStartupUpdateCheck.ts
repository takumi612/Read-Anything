import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createLogger } from "@renderer/logger";

const log = createLogger("update");

/** Kiểm tra cập nhật một lần khi khởi động; bản mới hiện toast có liên kết, kết quả khác chỉ ghi log khi lỗi. useRef tránh StrictMode chạy hai lần. */
export function useStartupUpdateCheck(): void {
  const { t } = useTranslation();
  const ranRef = useRef(false);
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      try {
        const res = await window.api.app.checkUpdate();
        if (res.status === "update-available") {
          toast(t("update.available", "Có phiên bản mới {{version}}", { version: res.latestVersion }), {
            action: {
              label: t("update.view", "Xem"),
              onClick: () => void window.api.app.openExternal({ url: res.releaseUrl }),
            },
            duration: 8000,
            closeButton: true,
          });
        } else if (res.status === "error") {
          log.warn("startup update check returned error", res.message);
        }
      } catch (err) {
        log.warn("startup update check failed", err);
      }
    })();
  }, [t]);
}
