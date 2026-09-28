import { createContext, useContext } from "react";
import type { ChatUIMessage } from "@renderer/ai/types";

export interface ChatActions {
  /** Gửi lại lượt người dùng để tạo câu trả lời mới mà không sửa văn bản. */
  resend(userMessage: ChatUIMessage): void;
  /** Sửa tin người dùng rồi tạo lại câu trả lời. */
  editAndResend(userMessage: ChatUIMessage, newText: string): void;
  /** Tạo lại một câu trả lời của trợ lý. */
  regenerate(assistantMessage: ChatUIMessage): void;
  /** True khi đang stream để tắt các nút thao tác. */
  busy: boolean;
}

export const ChatActionsContext = createContext<ChatActions | null>(null);

export function useChatActions(): ChatActions {
  const ctx = useContext(ChatActionsContext);
  if (!ctx) throw new Error("useChatActions must be used within ChatActionsContext.Provider");
  return ctx;
}

/** Id tin trợ lý ngay sau userMessageId trong messages, hoặc undefined nếu không có. */
export function nextAssistantId(
  messages: ChatUIMessage[],
  userMessageId: string,
): string | undefined {
  const i = messages.findIndex((m) => m.id === userMessageId);
  if (i < 0) return undefined;
  const next = messages[i + 1];
  return next?.role === "assistant" ? next.id : undefined;
}
