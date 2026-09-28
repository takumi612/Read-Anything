import type { SectionSelectEvent } from "@marginalia/virtual-docs";
import type { SelectionInfo } from "../types";

const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "LI",
  "BLOCKQUOTE",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "PRE",
  "FIGCAPTION",
  "TD",
  "TH",
]);

/** Lấy phần tử khối gần node nhất, kể cả chính node. */
function blockAncestor(node: Node): Element | null {
  let el: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    if (BLOCK_TAGS.has((el as Element).tagName)) return el as Element;
    el = el.parentNode;
  }
  return null;
}

/** Lấy văn bản của phần tử khối cùng cấp kế bên, bỏ text node chỉ có khoảng trắng. */
function siblingBlockText(el: Element, dir: "previous" | "next"): string | null {
  let sib: Element | null = dir === "previous" ? el.previousElementSibling : el.nextElementSibling;
  while (sib) {
    const t = (sib.textContent ?? "").trim();
    if (t.length > 0) return t;
    sib = dir === "previous" ? sib.previousElementSibling : sib.nextElementSibling;
  }
  return null;
}

/**
 * Đổi sự kiện onSelect thành SelectionInfo với locatorRange và cấu trúc AI hiện có.
 * Đoạn hiện tại lấy từ phần tử khối chứa đầu vùng chọn; đoạn trước và sau lấy từ phần tử cùng cấp.
 * Khi chọn qua nhiều khối, paragraphCurrent vẫn dùng khối đầu, khối cuối có thể nằm trong paragraphAfter.
 * Ngữ cảnh này đủ cho AI. Nếu không tìm được phần tử khối, vẫn gửi văn bản được chọn.
 */
export function sectionSelectToSelectionInfo(
  e: SectionSelectEvent,
  locatorRange: string | null,
): SelectionInfo {
  const block = blockAncestor(e.range.startContainer);
  const paragraphCurrent = (block?.textContent ?? e.text).trim();
  const paragraphBefore = block ? siblingBlockText(block, "previous") : null;
  const paragraphAfter = block ? siblingBlockText(block, "next") : null;
  return {
    selectionText: e.text,
    paragraphBefore,
    paragraphCurrent: paragraphCurrent.length > 0 ? paragraphCurrent : e.text,
    paragraphAfter,
    rect: e.rect, // Package đã đổi sang tọa độ khung nhìn, cùng cấu trúc với SelectionInfo.rect.
    locatorRange,
  };
}
