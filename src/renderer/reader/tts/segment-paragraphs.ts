/**
 * Một đoạn đọc thành tiếng: text đã chuẩn hóa khoảng trắng, element là điểm neo tô sáng và cuộn.
 * Giữ Element thay cho Range đang sống; khi cần tô sáng mới gọi range.selectNodeContents(element),
 * giúp điểm neo ít bị mất hiệu lực.
 */
export interface TtsParagraph {
  text: string;
  element: Element;
}

/** Selector đoạn dạng khối giống EpubReader.topElementCfi, thêm div lá cho ePub dùng div làm đoạn. */
const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dt,dd,pre,div";

const SKIP_CLOSEST = "script,style,template,noscript,[hidden],[aria-hidden='true']";

/**
 * Chia section thành các đoạn đọc theo thứ tự từ phần tử khối sâu nhất, tránh đọc lặp vùng lồng nhau.
 * Chuẩn hóa khoảng trắng và bỏ đoạn rỗng, chỉ có dấu câu hoặc nằm trong cây bị ẩn.
 * Giới hạn hiện tại: text node trực tiếp trong khung cũng chứa khối con sẽ không được đọc.
 * Đây là hệ quả của việc chỉ chọn phần tử khối sâu nhất.
 */
export function segmentParagraphs(root: ParentNode): TtsParagraph[] {
  const out: TtsParagraph[] = [];
  for (const el of root.querySelectorAll(BLOCK_SELECTOR)) {
    if (el.querySelector(BLOCK_SELECTOR)) continue;
    if (el.closest(SKIP_CLOSEST)) continue;
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
    out.push({ text, element: el });
  }
  return out;
}
