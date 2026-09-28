import type { Chip } from "@shared/chat";
import i18n from "@renderer/i18n";

/** Nhãn chip được dịch tại thời điểm gọi để theo ngôn ngữ giao diện hiện tại. */
export const chipLabel = (chip: Chip): string => {
  switch (chip.labelKey) {
    case "chip.selection":
      return i18n.t("ai.chip.selection", "Đoạn chọn");
    case "chip.paragraph":
      return i18n.t("ai.chip.paragraph", "Ngữ cảnh đoạn văn");
    case "chip.chapterSummary":
      return i18n.t("ai.chip.chapterSummary", "Tóm tắt chương");
    case "chip.bookSummary":
      return i18n.t("ai.chip.bookSummary", "Tóm tắt sách");
    default:
      return chip.labelKey;
  }
};
