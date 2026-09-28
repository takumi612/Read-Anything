import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { AppNotification } from "@shared/chat";

/** Hàm thuần đổi thông báo thành nội dung toast đã dịch; trả null nếu không có gì để hiện. */
export function notificationMessage(n: AppNotification, t: TFunction): string | null {
  switch (n.kind) {
    case "memoryConsolidated": {
      if (n.saved + n.updated + n.deleted <= 0) return null;
      return t("notify.memoryConsolidated", "Lia đã sắp xếp lại bộ nhớ · thêm {{saved}} · cập nhật {{updated}}", {
        saved: n.saved,
        updated: n.updated,
      });
    }
    default:
      return null;
  }
}

/** Đăng ký thông báo từ main process sang renderer và hiện toast đã dịch; gọi một lần khi App gắn. */
export function useAppNotifications(): void {
  const { t } = useTranslation();
  useEffect(() => {
    if (typeof window === "undefined" || !window.api?.app?.onNotify) return;
    const unsub = window.api.app.onNotify((n) => {
      const msg = notificationMessage(n, t);
      if (msg) toast(msg);
    });
    return unsub;
  }, [t]);
}
