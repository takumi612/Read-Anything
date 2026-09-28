// src/renderer/ai/selection-context.ts
import type { Chip } from "@shared/chat";

export interface SelectionContext {
  selection: Chip | null;
  paragraph: Chip | null;
  tokenTotal: number;
}

/** Nhìn chung ngữ cảnh vùng chọn trong bản nháp từ chip selection và paragraph; thiếu cả hai thì null. */
export function selectionContextOf(chips: Chip[]): SelectionContext | null {
  const selection = chips.find((c) => c.id === "selection") ?? null;
  const paragraph = chips.find((c) => c.id === "paragraph") ?? null;
  if (!selection && !paragraph) return null;
  return {
    selection,
    paragraph,
    tokenTotal: (selection?.tokenCount ?? 0) + (paragraph?.tokenCount ?? 0),
  };
}

/** Xóa toàn bộ ngữ cảnh vùng chọn khỏi bản nháp trước khi gửi. */
export function withoutSelectionContext(chips: Chip[]): Chip[] {
  return chips.filter((c) => c.id !== "selection" && c.id !== "paragraph");
}
