// Kiểu dữ liệu cục bộ của bản mẫu (không sao chép shared/ hoặc AI SDK; chỉ dùng cho UI mẫu).

export type SummaryStatus = "pending" | "generating" | "ready" | "unavailable";

/** Thao tác AI đặt sẵn trên thanh công cụ nổi ("AI hỏi" = null, không có mẫu). */
export type PresetId = "explain" | "translate" | "summarize";

export interface TocNode {
  id: string;
  label: string;
  chapterId: string;
  children?: TocNode[];
}

export interface Chapter {
  id: string;
  title: string;
  paragraphs: string[];
  summaryStatus: SummaryStatus;
  /** Nội dung tóm tắt chương (hiển thị khi status=ready). */
  summary: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  chapters: Chapter[];
  toc: TocNode[];
  /** Nội dung tóm tắt toàn sách / global (được đưa vào Phase 1 ngày 2026-06-01). */
  summary: string;
  summaryStatus: SummaryStatus;
}

/** Kết quả trích xuất vùng chọn ở lớp hiển thị (bản mẫu khôi phục vùng chọn bằng API vùng chọn gốc của trình duyệt trên văn bản tĩnh). */
export interface SelectionInfo {
  selectionText: string;
  paragraphText: string;
  /** Các chương mà vùng chọn chạm tới (khử trùng lặp theo thứ tự tài liệu); length > 1 = chọn xuyên chương. */
  chapterIds: string[];
  /** Tọa độ con trỏ trong khung nhìn khi kết thúc chọn văn bản (dùng để đặt thanh công cụ nổi cạnh con trỏ). */
  anchor: { x: number; y: number };
  /** Các khoảng ký tự tách theo đoạn từ vùng chọn (dùng để tạo mục đánh dấu và hiển thị tô sáng). */
  ranges: AnnoRange[];
}

// ——— Đánh dấu / ghi chú (tô sáng + ghi chú kiểu Apple Books) ———

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

/** Khoảng ký tự được đánh dấu trong một đoạn văn (theo chỉ số chuỗi của đoạn). */
export interface AnnoRange {
  chapterId: string;
  /** Chỉ số của đoạn trong danh sách paragraphs của chương này. */
  paragraphIndex: number;
  start: number;
  end: number;
}

export interface Annotation {
  id: string;
  color: HighlightColor;
  /** Nội dung ghi chú; "" = chỉ tô sáng, không có ghi chú. */
  note: string;
  /** Văn bản gốc được tô sáng (hiển thị trong danh sách mục đánh dấu). */
  text: string;
  /** Chương bắt đầu (dùng để nhóm danh sách). */
  chapterId: string;
  /** Khi vùng chọn đi qua nhiều đoạn, một mục đánh dấu chứa nhiều khoảng. */
  ranges: AnnoRange[];
  createdAt: number;
}

export type ChipId = "selection" | "paragraph";

export interface Chip {
  id: ChipId;
  labelKey: string;
  content: string;
  tokenCount: number;
  required: boolean;
  enabled: boolean;
}

export interface ToolStep {
  id: string;
  label: string;
  detail: string;
  status: "running" | "done";
}

export type ChatMessage =
  | { id: string; role: "user"; text: string; chips: Chip[] }
  | {
      id: string;
      role: "assistant";
      steps: ToolStep[];
      text: string;
      status: "streaming" | "done" | "error";
    };

/** Mục hội thoại trong danh sách thanh bên (bản mẫu chỉ dùng để minh họa giao diện). */
export interface ConversationMeta {
  id: string;
  title: string;
  chapterId: string | null; // null = hội thoại riêng (xuyên chương)
}

export interface ReaderPrefs {
  /** Tỷ lệ cỡ chữ nội dung (1 = mặc định). */
  fontScale: number;
  lineHeight: number;
  /** Chiều rộng tối đa của cột nội dung (px). */
  maxWidth: number;
}
