import type { BackupKind } from "@shared/backup";

export function restoreConfirmationCopy(kind: BackupKind) {
  return kind === "compact"
    ? {
        kindKey: "settings.backup.kindCompact",
        kind: "Bản sao lưu gọn nhẹ",
        confirmationKey: "settings.backup.confirmCompactRestore",
        confirmation:
          "Thao tác này sẽ thay thế toàn bộ dữ liệu ứng dụng bằng bản sao lưu gọn nhẹ gồm {{count}} cuốn sách, xuất lúc {{when}}. Tệp sách gốc trên thiết bị này vẫn được giữ lại. Bạn có thể kết nối lại những sách không có tệp cục bộ sau khi khôi phục. Cơ sở dữ liệu hiện tại sẽ được sao lưu trước, sau đó ứng dụng khởi động lại.",
      }
    : {
        kindKey: "settings.backup.kindFull",
        kind: "Bản sao lưu đầy đủ",
        confirmationKey: "settings.backup.confirmFullRestore",
        confirmation:
          "Thao tác này sẽ thay thế toàn bộ dữ liệu và tệp sách gốc bằng bản sao lưu đầy đủ gồm {{count}} cuốn sách, xuất lúc {{when}}. Dữ liệu hiện tại sẽ được sao lưu trước, sau đó ứng dụng khởi động lại.",
      };
}
