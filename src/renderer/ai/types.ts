import type { UIMessage } from "ai";
import type { Chip } from "@shared/chat";

/**
 * Metadata của UIMessage đang dùng trong renderer: tin người dùng mang chip ngữ cảnh hiện tại
 * và thời điểm gửi. Tin cũ lấy thời điểm từ MessageDto.createdAt; tin đang stream tạm dùng giờ hiện tại.
 */
export interface ChatMetadata {
  contextChips?: Chip[];
  /** epoch ms。 */
  createdAt?: number;
}

/** Kiểu tin nhắn dùng xuyên suốt useChat và transport. */
export type ChatUIMessage = UIMessage<ChatMetadata>;
