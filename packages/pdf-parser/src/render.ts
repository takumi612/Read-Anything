import { createCanvas } from "@napi-rs/canvas";
import { openPdf } from "./parse";

export interface RenderOptions {
  /** Hệ số vẽ; nếu thiếu thì tính từ targetWidth. */
  scale?: number;
  /** Chiều rộng đích tính bằng pixel; nếu có scale thì ưu tiên scale. */
  targetWidth?: number;
}

/**
 * Vẽ một trang thành PNG trong Node bằng @napi-rs/canvas,
 * không dùng API canvasFactory nội bộ của pdfjs. Giới hạn scale ở 4 để tránh hết bộ nhớ.
 */
export async function renderPageImage(
  bytes: Uint8Array,
  pageNo: number,
  opts: RenderOptions = {},
): Promise<Uint8Array> {
  // Từ chối scale/targetWidth không dương để tránh lưu ảnh bìa rỗng 0×0.
  if (opts.scale !== undefined && opts.scale <= 0) {
    throw new RangeError(`renderPageImage: scale must be positive, got ${opts.scale}`);
  }
  if (opts.targetWidth !== undefined && opts.targetWidth <= 0) {
    throw new RangeError(`renderPageImage: targetWidth must be positive, got ${opts.targetWidth}`);
  }
  const doc = await openPdf(bytes);
  try {
    const page = await doc.getPage(pageNo);
    try {
      const base = page.getViewport({ scale: 1 });
      const scale = opts.scale ?? (opts.targetWidth ? opts.targetWidth / base.width : 1);
      const viewport = page.getViewport({ scale: Math.min(scale, 4) });
      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const context = canvas.getContext("2d");
      // Kiểu pdfjs yêu cầu HTMLCanvasElement, còn Node dùng @napi-rs/canvas;
      // runtime chỉ cần các phương thức canvas tương thích.
      await page.render({ canvasContext: context as never, canvas: canvas as never, viewport })
        .promise;
      return new Uint8Array(canvas.toBuffer("image/png"));
    } finally {
      // Nếu vẽ lỗi, dọn page intent trước để doc.cleanup không báo trang còn đang vẽ.
      page.cleanup();
    }
  } finally {
    await doc.cleanup();
    await doc.loadingTask.destroy();
  }
}
