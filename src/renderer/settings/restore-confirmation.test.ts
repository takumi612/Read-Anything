import { describe, expect, it } from "vitest";

import { restoreConfirmationCopy } from "@renderer/settings/restore-confirmation";

describe("restoreConfirmationCopy", () => {
  it("selects the full-backup confirmation copy", () => {
    expect(restoreConfirmationCopy("full")).toEqual({
      kindKey: "settings.backup.kindFull",
      kind: "Bản sao lưu đầy đủ",
      confirmationKey: "settings.backup.confirmFullRestore",
      confirmation:
        "Thao tác này sẽ thay thế toàn bộ dữ liệu và tệp sách gốc bằng bản sao lưu đầy đủ gồm {{count}} cuốn sách, xuất lúc {{when}}. Dữ liệu hiện tại sẽ được sao lưu trước, sau đó ứng dụng khởi động lại.",
    });
  });

  it("selects the compact-backup confirmation copy", () => {
    expect(restoreConfirmationCopy("compact")).toEqual({
      kindKey: "settings.backup.kindCompact",
      kind: "Bản sao lưu gọn nhẹ",
      confirmationKey: "settings.backup.confirmCompactRestore",
      confirmation:
        "Thao tác này sẽ thay thế toàn bộ dữ liệu ứng dụng bằng bản sao lưu gọn nhẹ gồm {{count}} cuốn sách, xuất lúc {{when}}. Tệp sách gốc trên thiết bị này vẫn được giữ lại. Bạn có thể kết nối lại những sách không có tệp cục bộ sau khi khôi phục. Cơ sở dữ liệu hiện tại sẽ được sao lưu trước, sau đó ứng dụng khởi động lại.",
    });
  });
});
