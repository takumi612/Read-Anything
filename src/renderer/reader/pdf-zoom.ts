/** Phạm vi và bước zoom PDF tính theo chế độ vừa chiều rộng, bước nhỏ 10% như fontScale của ePub. */
export const PDF_ZOOM_MIN = 0.25;
export const PDF_ZOOM_MAX = 5;
export const PDF_ZOOM_STEP = 0.1;

/**
 * Chuẩn hóa hệ số zoom vào phạm vi hợp lệ và làm tròn tới phần trăm nguyên.
 * Chẳng hạn 0.876 thành 88%; cũng tránh sai số dấu phẩy động khi cộng nhiều bước 0.1.
 * Giá trị lưu là hệ số gốc trong pdfZoom; mọi nơi dùng đều chuẩn hóa qua hàm này.
 */
export function clampPdfZoom(scale: number): number {
  const clamped = Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, scale));
  return Math.round(clamped * 100) / 100;
}

/** Clamp the live gesture value without percent rounding so touchpad zoom can move smoothly. */
export function clampPdfZoomScale(scale: number): number {
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, scale));
}

/**
 * Độ nhạy zoom bằng con lăn hoặc chụm: một nấc với |deltaY| khoảng 100 đổi gần 28%.
 * Chụm trên bàn di chuột tạo deltaY nhỏ mỗi frame nên cần tích lũy; bước nhân tăng theo mức zoom.
 */
export const PDF_WHEEL_ZOOM_SENSITIVITY = 0.0025;

/**
 * Tính zoom kế tiếp theo phép nhân; cuộn lên với deltaY<0 là phóng to.
 * Trả giá trị chính xác chưa làm tròn để bên gọi tích lũy trong ref,
 * rồi mới qua clampPdfZoom khi lưu; tránh chụm chậm bị kẹt ở bước 1%.
 */
export function nextZoom(current: number, deltaY: number): number {
  const next = current * Math.exp(-deltaY * PDF_WHEEL_ZOOM_SENSITIVITY);
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, next));
}
