import { isToolUIPart } from "ai";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ChatUIMessage } from "@renderer/ai/types";

/** Tool part có thể hiển thị trong bong bóng chat, gồm dạng tĩnh và động. */
export type ToolPart = ToolUIPart | DynamicToolUIPart;

/** Một đoạn trong bong bóng chat: khối văn bản đã gộp hoặc một dòng bước công cụ. */
export type Segment = { kind: "text"; text: string } | { kind: "tool"; part: ToolPart };

/**
 * Gộp UIMessage.parts theo thứ tự xuất hiện. Các text part liên tiếp thành một đoạn
 * để Markdown không bị tách, giống hành vi nối của textOf. Mỗi tool part là một đoạn riêng;
 * bỏ các part khác như step-start và text part rỗng ở đầu stream.
 */
export function segments(parts: ChatUIMessage["parts"]): Segment[] {
  const out: Segment[] = [];
  for (const p of parts) {
    if (p.type === "text") {
      if (p.text === "") continue;
      // Chỉ gộp trên object mới của lần gọi này; bên gọi không cache Segment qua các lần gọi.
      const last = out.at(-1);
      if (last?.kind === "text") last.text += p.text;
      else out.push({ kind: "text", text: p.text });
    } else if (isToolUIPart(p)) {
      out.push({ kind: "tool", part: p });
    }
  }
  return out;
}
