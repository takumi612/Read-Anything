/** Thông tin vùng chọn do EpubReader ghi qua epub-selection, khớp các trường của buildChipsInput. */
export interface SelectionInfo {
  selectionText: string;
  paragraphBefore: string | null;
  paragraphCurrent: string;
  paragraphAfter: string | null;
  /** Hình chữ nhật neo vùng chọn để đặt thanh công cụ nổi. */
  rect: { x: number; y: number; width: number; height: number } | null;
  /** Locator range của vùng chọn để neo chú thích; chip AI không cần trường này. */
  locatorRange: string | null;
}

// ReaderPrefs và ReaderLayout dùng chung Zod schema trong @shared/preferences để lưu vào bảng preferences.
export type { ReaderFontFamily, ReaderLayout, ReaderPrefs } from "@shared/preferences";
