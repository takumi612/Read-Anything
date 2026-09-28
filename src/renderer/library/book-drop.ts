/** Chỉ phản hồi khi dữ liệu kéo chứa tệp bên ngoài, bỏ qua chữ được chọn và phần tử nội bộ. */
export function isFilesDrag(types: readonly string[]): boolean {
  return types.includes("Files");
}

const BOOK_EXTENSIONS = [".epub", ".pdf"];

export interface SortedDrop<T> {
  books: T[];
  ignored: T[];
}

/**
 * Nhóm tệp kéo vào theo đuôi sách hỗ trợ, không phân biệt hoa thường.
 * Không dựa vào MIME vì type có thể không ổn định; thư mục hoặc tệp không khớp vào ignored.
 * Giữ kiểu File và thứ tự đầu vào để kết quả có thể kiểm tra ổn định.
 */
export function pickBookFiles<T extends { name: string }>(files: readonly T[]): SortedDrop<T> {
  const books: T[] = [];
  const ignored: T[] = [];
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (BOOK_EXTENSIONS.some((ext) => lower.endsWith(ext))) books.push(f);
    else ignored.push(f);
  }
  return { books, ignored };
}

/** Lấy tên tệp cuối đường dẫn để báo lỗi nhập sách, hỗ trợ cả / và \. */
export function fileNameOf(path: string): string {
  const seg = path.split(/[\\/]/);
  return seg[seg.length - 1] || path;
}
