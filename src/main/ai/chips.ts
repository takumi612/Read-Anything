// src/main/ai/chips.ts
import { estimateTokens } from "@shared/tokens";
import type { BuildChipsInput, Chip } from "@shared/chat";
import type { MessageMetadata } from "@shared/types";

/** Tạo chip đoạn chọn/đoạn văn từ renderer; chip mới bật sẵn và có thể xóa trong UI. */
export function buildChips(input: BuildChipsInput): Chip[] {
  const chips: Chip[] = [];

  const selection = input.selection.trim();
  chips.push({
    id: "selection",
    labelKey: "chip.selection",
    content: selection,
    tokenCount: estimateTokens(selection),
    state: "on",
  });

  const paragraph = [input.paragraphBefore, input.paragraphCurrent, input.paragraphAfter]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join("\n\n");
  if (paragraph) {
    chips.push({
      id: "paragraph",
      labelKey: "chip.paragraph",
      content: paragraph,
      tokenCount: estimateTokens(paragraph),
      state: "on",
    });
  }

  return chips;
}

/** Bỏ chip đoạn văn nếu trùng với đoạn gần nhất đã gửi trong hội thoại. */
export function dedupeParagraph(chips: Chip[], previousParagraph: string | null): Chip[] {
  if (previousParagraph == null) return chips;
  return chips.filter((c) => !(c.id === "paragraph" && c.content === previousParagraph));
}

/** Chuyển chip hiện tại thành snapshot lưu trong metadata.contextChips. */
export function toContextChips(chips: Chip[]): NonNullable<MessageMetadata["contextChips"]> {
  return chips.map((c) => ({ id: c.id, content: c.content, tokenCount: c.tokenCount }));
}
