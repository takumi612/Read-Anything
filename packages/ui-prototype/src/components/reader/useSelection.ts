// Dùng vùng chọn gốc của trình duyệt trên nội dung tĩnh để tái hiện "trích xuất vùng chọn ở lớp hiển thị": lấy văn bản được chọn +
// một đoạn ngữ cảnh trước/sau các đoạn bị chạm tới (kể cả chọn qua nhiều đoạn/chương) + tập chương liên quan + tọa độ con trỏ trong khung nhìn. Logic truy xuất đoạn từ DOM này có thể tái sử dụng trực tiếp ở lớp hiển thị sau này.

import { useEffect, type RefObject } from "react";
import type { SelectionInfo } from "#/mock/types";

function closestEl(node: Node, selector: string): HTMLElement | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  return el?.closest(selector) ?? null;
}

function textOf(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

function paragraphOf(node: Node): HTMLElement | null {
  return closestEl(node, "[data-paragraph]");
}

function chapterIdOf(el: Element): string {
  return el.closest("[data-chapter]")?.getAttribute("data-chapter") ?? "";
}

// Độ lệch ký tự trong đoạn: độ dài văn bản từ đầu đoạn đến (container, offset)
function offsetInPara(para: Element, container: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(para);
  try {
    r.setEnd(container, offset);
  } catch {
    return para.textContent?.length ?? 0;
  }
  return r.toString().length;
}

export function useSelection(
  containerRef: RefObject<HTMLElement | null>,
  onSelect: (info: SelectionInfo | null) => void,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // px/py = tọa độ con trỏ trong khung nhìn khi kết thúc chọn văn bản (mouseup), dùng để đặt thanh công cụ cạnh con trỏ
    const compute = (px: number, py: number) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        onSelect(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        onSelect(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      // Dùng container đầu/cuối để xác định đoạn đầu/cuối (khi đi qua nhiều đoạn/chương, tổ tiên chung không phải là đoạn văn)
      const startPara = paragraphOf(range.startContainer);
      const endPara = paragraphOf(range.endContainer);
      const anchorPara = startPara ?? endPara;
      if (!anchorPara) {
        onSelect(null);
        return;
      }

      // Làm phẳng toàn bộ đoạn trong container rồi cắt theo chỉ số đoạn đầu/cuối → tự nhiên hỗ trợ chọn qua nhiều đoạn/chương
      const all = Array.from(container.querySelectorAll<HTMLElement>("[data-paragraph]"));
      const idxs = [startPara, endPara].map((p) => (p ? all.indexOf(p) : -1)).filter((i) => i >= 0);
      const span = idxs.length ? idxs : [all.indexOf(anchorPara)];
      const lo = Math.min(...span);
      const hi = Math.max(...span);

      const selected = all.slice(lo, hi + 1);
      const chapterIds = [...new Set(selected.map(chapterIdOf).filter(Boolean))];
      // Ngữ cảnh xung quanh = đoạn được chọn + một đoạn trước/sau (nguyên văn)
      const ctx = all.slice(Math.max(0, lo - 1), hi + 2);

      // Tách vùng chọn thành các khoảng ký tự theo đoạn (dùng để tạo mục đánh dấu / hiển thị tô sáng)
      const ranges = selected
        .map((para) => {
          const full = para.textContent ?? "";
          const s =
            para === startPara ? offsetInPara(para, range.startContainer, range.startOffset) : 0;
          const e =
            para === endPara
              ? offsetInPara(para, range.endContainer, range.endOffset)
              : full.length;
          return {
            chapterId: chapterIdOf(para),
            paragraphIndex: Number(para.dataset.pidx ?? "-1"),
            start: Math.min(s, e),
            end: Math.max(s, e),
          };
        })
        .filter((r) => r.paragraphIndex >= 0 && r.end > r.start);

      onSelect({
        selectionText: text,
        paragraphText: ctx.map(textOf).filter(Boolean).join("\n\n"),
        chapterIds,
        anchor: { x: px, y: py },
        ranges,
      });
    };

    // Vùng chọn chỉ ổn định sau mouseup; tính ở khung hình kế tiếp và ghi lại vị trí con trỏ
    const onMouseUp = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      window.setTimeout(() => compute(clientX, clientY), 0);
    };
    // Vùng chọn bị xóa (nhấp nơi khác) → ẩn thanh công cụ
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) onSelect(null);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [containerRef, onSelect]);
}
