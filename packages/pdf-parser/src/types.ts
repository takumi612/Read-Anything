/** Có cùng cấu trúc với TocNode của @marginalia/epub-parser, tương thích kiểu cấu trúc mà không thêm dependency. */
export interface TocNode {
  label: string;
  href: string;
  children?: TocNode[];
}

/** Khoảng trang của chương, đánh số từ 1 và tính cả hai đầu; tương ứng toc[i].href === "pdf-ch:i". */
export interface ChapterRange {
  startPage: number;
  endPage: number;
}

/** Kết quả của parsePdf. */
export interface ParsedPdf {
  title?: string;
  author?: string;
  pageCount: number;
  /** Mục lục outline đã làm phẳng; [] nếu không có outline (bên dùng xem như một chương). */
  toc: TocNode[];
  /** Khoảng trang theo chương; nếu không có outline thì dùng [{ startPage: 1, endPage: pageCount }]. */
  chapterRanges: ChapterRange[];
  /** Phát hiện lớp chữ: false nếu số ký tự trung bình trên 8 trang đầu thấp hơn ngưỡng (PDF scan). */
  hasTextLayer: boolean;
}

/** Có cùng cấu trúc với ChapterTextSlice của epub-parser. */
export interface ChapterTextSlice {
  text: string;
  hasMore: boolean;
  nextOffset: number;
}
