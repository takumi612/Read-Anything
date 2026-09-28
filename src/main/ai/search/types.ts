/** Một kết quả tìm kiếm. */
export interface SearchHit {
  /** Tiêu đề trang. */
  title: string;
  /** URL trang. */
  url: string;
  /** Tóm tắt do công cụ tìm kiếm trả về hoặc trích từ nội dung trang. */
  snippet: string;
  /** Ngày xuất bản dạng ISO 8601 nếu nguồn cung cấp. */
  publishedDate?: string;
}

/**
 * Giao diện backend tìm kiếm. SearchService thử từng backend theo thứ tự
 * và dùng backend kế tiếp khi backend trước lỗi.
 */
export interface SearchBackend {
  /** ID backend dùng trong log và chẩn đoán. */
  readonly id: string;
  /**
   * Tìm kiếm và trả danh sách kết quả; ném lỗi để SearchService thử backend tiếp theo.
   */
  search(query: string, opts: { numResults?: number }): Promise<SearchHit[]>;
  /** Giải phóng kết nối mạng và tài nguyên của backend. */
  close(): Promise<void>;
}
