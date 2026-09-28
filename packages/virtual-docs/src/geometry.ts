/** Hình chữ nhật vùng chọn trong tọa độ viewport, cùng cấu trúc với SelectionInfo.rect ở renderer. */
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Chuyển rect từ tọa độ iframe sang viewport chính bằng cách cộng độ lệch góc trên trái của iframe. */
export function toViewportRect(
  rangeRect: { left: number; top: number; width: number; height: number },
  iframeRect: { left: number; top: number },
): ViewportRect {
  return {
    x: rangeRect.left + iframeRect.left,
    y: rangeRect.top + iframeRect.top,
    width: rangeRect.width,
    height: rangeRect.height,
  };
}
