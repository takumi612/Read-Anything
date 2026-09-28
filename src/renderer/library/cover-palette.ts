/**
 * Bảng màu chuyển sắc cho sách không có bìa. Viết class dưới dạng literal để Tailwind JIT nhận diện,
 * rồi dùng với `bg-gradient-to-br ${coverGradientClass(id)}`.
 */
export const COVER_GRADIENTS = [
  "from-violet-500 to-violet-900",
  "from-rose-500 to-rose-900",
  "from-emerald-500 to-emerald-900",
  "from-sky-500 to-sky-900",
  "from-amber-500 to-amber-800",
  "from-fuchsia-500 to-fuchsia-900",
  "from-teal-500 to-teal-900",
  "from-indigo-500 to-indigo-900",
] as const;

/** Chọn màu xác định từ bookId: cùng sách luôn cùng màu, các sách khác nhau có nhiều màu. */
export function coverGradientClass(bookId: string): string {
  let h = 0;
  for (let i = 0; i < bookId.length; i++) h = (h * 31 + bookId.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}
