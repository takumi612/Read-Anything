import type { Chip, MessageDto } from "@shared/chat";
import type { ChatUIMessage } from "@renderer/ai/types";

type ChipSnapshot = NonNullable<NonNullable<MessageDto["metadata"]>["contextChips"]>[number];

/** Ánh xạ id snapshot sang labelKey, khớp cách tạo chip ở main process và renderer. */
const LABEL_KEY: Record<ChipSnapshot["id"], string> = {
  selection: "chip.selection",
  paragraph: "chip.paragraph",
  "chapter-summary": "chip.chapterSummary",
  "book-summary": "chip.bookSummary",
};

/**
 * Chuyển snapshot đã lưu {id,content,tokenCount} thành Chip; suy ra labelKey từ id.
 * Chip đã lưu tức là đã được gửi, lịch sử không tương tác nên luôn nạp ở trạng thái required.
 */
function hydrateChip(snapshot: ChipSnapshot): Chip {
  return { ...snapshot, labelKey: LABEL_KEY[snapshot.id], state: "required" };
}

/**
 * Chuyển MessageDto đã lưu thành ChatUIMessage cho useChat.
 * parts đã có dạng UIMessage["parts"] và role tương thích với UIMessage.
 * Nạp metadata.contextChips từ snapshot để hiện lại huy hiệu chip khi mở hội thoại cũ.
 * Giữ createdAt để hiển thị thời gian và dòng ngăn cách theo ngày.
 */
export function messageDtoToUIMessage(dto: MessageDto): ChatUIMessage {
  const chips = dto.metadata?.contextChips;
  const metadata: ChatUIMessage["metadata"] = { createdAt: dto.createdAt };
  if (chips && chips.length > 0) metadata.contextChips = chips.map(hydrateChip);
  return { id: dto.id, role: dto.role, parts: dto.parts, metadata };
}

export function messagesToUI(dtos: MessageDto[]): ChatUIMessage[] {
  return dtos.map(messageDtoToUIMessage);
}
