import type { AnnotationStyle } from "@shared/annotations";

/** Năm khóa màu tô nền; gạch dưới được xử lý riêng và không có chấm màu. */
export const FILL_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type FillColor = (typeof FILL_COLORS)[number];

/** Trong tài liệu chính có Tailwind: chấm màu trên thanh công cụ và vạch màu ở danh sách bên. */
export const FILL_SWATCH: Record<FillColor, string> = {
  yellow: "bg-yellow-300",
  green: "bg-green-300",
  blue: "bg-sky-300",
  pink: "bg-pink-300",
  purple: "bg-purple-300",
};

export const STYLE_STRIPE: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-sky-400",
  pink: "bg-pink-400",
  purple: "bg-purple-400",
  underline: "bg-foreground/40",
};

/**
 * Kiểu hình chữ nhật tô sáng PDF trong tài liệu chính có Tailwind: màu bán trong suốt
 * nằm trên canvas và dưới textLayer. Kiểu underline chỉ vẽ đường dưới, không tô nền.
 * Chế độ tối đảo màu canvas nhưng không đảo lớp phủ; độ mờ 45% vẫn đọc được ở cả hai chế độ.
 */
export const OVERLAY_FILL: Record<string, string> = {
  yellow: "bg-yellow-300/45",
  green: "bg-green-300/45",
  blue: "bg-sky-300/45",
  pink: "bg-pink-300/45",
  purple: "bg-purple-300/45",
  underline: "border-b-2 border-foreground/60",
};

/**
 * Kiểm tra có ghi chú dùng chung cho .anno-noted của ePub và viền chấm của lớp phủ PDF.
 * Nếu đổi nghĩa của ghi chú, chỉ cần sửa điều kiện ở đây.
 */
export function hasNote(note: string): boolean {
  return note.trim().length > 0;
}

/**
 * Class hình chữ nhật PDF thêm viền chấm khi có ghi chú, đồng bộ với .anno-noted của ePub.
 * Nếu đổi cách hiển thị ở đây, cập nhật cả ANNO_IFRAME_CSS bên dưới.
 * Với underline, thay viền liền bằng chấm và giữ độ đậm /60. Với nền màu, dùng /70
 * để đủ tương phản. border-foreground tự thích ứng với chế độ sáng tối.
 */
export function overlayClass(style: AnnotationStyle, noted: boolean): string {
  if (style.startsWith("#")) {
    return noted ? "bg-transparent border-b-2 border-dotted border-foreground/70" : "bg-transparent";
  }
  if (!noted) return OVERLAY_FILL[style]!;
  if (style === "underline") return "border-b-2 border-dotted border-foreground/60";
  return `${OVERLAY_FILL[style]} border-b-2 border-dotted border-foreground/70`;
}

/**
 * CSS tô sáng chèn vào iframe srcdoc của từng section vì Tailwind của ứng dụng không áp dụng ở đó.
 * .anno có thể nhấn, năm màu dùng nền và underline dùng text-decoration.
 * .anno-noted thêm gạch dưới dạng chấm khi có ghi chú, đồng bộ với overlayClass của PDF.
 */
export const ANNO_IFRAME_CSS = [
  "mark.anno { background: transparent; cursor: pointer; }",
  "mark.anno-yellow { background: rgba(254,240,138,0.7); }",
  "mark.anno-green { background: rgba(187,247,208,0.7); }",
  "mark.anno-blue { background: rgba(186,230,253,0.7); }",
  "mark.anno-pink { background: rgba(251,207,232,0.7); }",
  "mark.anno-purple { background: rgba(233,213,255,0.7); }",
  "mark.anno-custom { background: color-mix(in srgb, var(--anno-custom-color) 70%, transparent); }",
  "mark.anno-underline { background: transparent; text-decoration: underline; text-decoration-color: rgba(120,120,120,0.9); text-decoration-thickness: 2px; }",
  // Dùng thuộc tính riêng thay vì viết tắt text-decoration để giữ color và thickness của .anno-underline.
  // Đặt line:underline rõ ràng để nền màu cũng có dấu chấm báo ghi chú,
  // đồng thời giữ màu xám và độ dày 2px của kiểu gạch dưới qua cascade.
  "mark.anno-noted { text-decoration-line: underline; text-decoration-style: dotted; text-underline-offset: 3px; }",
].join("\n");
