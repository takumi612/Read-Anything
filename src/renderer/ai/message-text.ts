import type { ChatUIMessage } from "@renderer/ai/types";

/** Nối mọi text part của tin nhắn, bỏ tool/step part, để lấy nguồn Markdown. */
export function textOf(m: ChatUIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}
