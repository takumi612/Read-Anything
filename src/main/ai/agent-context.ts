// Dựng ba lớp giữa của system prompt: instructions, SOUL và chỉ mục bộ nhớ.
// Snapshot theo hội thoại giữ trong Map của tiến trình; khởi động lại sẽ dựng lại.
import type { DB } from "@main/db/client";
import { getPreference } from "@main/preferences/repository";
import { listMemories } from "@main/memory/repository";
import { DEFAULT_SOUL } from "@shared/preferences";

const snapshots = new Map<string, string>();

export function renderReaderInstructions(db: DB): string | null {
  const instructions = getPreference(db, "instructions")?.trim();
  return instructions ? `## Reader instructions\n\n${instructions}` : null;
}

export function renderAssistantIdentity(db: DB): string {
  const soul = getPreference(db, "soul") ?? DEFAULT_SOUL;
  return `## Who you are\n\nYour name is ${soul.name}. ${soul.persona}`.trimEnd();
}

export function renderMemoryIndex(db: DB): string | null {
  const memoryEnabled = getPreference(db, "memoryEnabled") ?? true;
  if (!memoryEnabled) return null;
  const all = listMemories(db); // Đã sắp ổn định theo createdAt và ID.
  if (all.length === 0) return null;
  const lines = all.map((memory) => `- [${memory.slug}] ${memory.title} — ${memory.description}`);
  return `## Memory index\n\n${lines.join("\n")}`;
}

/** Dựng instructions, SOUL và chỉ mục bộ nhớ; bỏ cả đoạn khi không có nội dung. */
export function renderAgentContext(db: DB): string {
  return [renderReaderInstructions(db), renderAssistantIdentity(db), renderMemoryIndex(db)]
    .filter((section): section is string => section !== null)
    .join("\n\n");
}

/** Dựng một lần ở lượt đầu rồi dùng lại nguyên văn để tiền tố cache của provider ổn định. */
export function getAgentContext(db: DB, conversationId: string): string {
  const cached = snapshots.get(conversationId);
  if (cached !== undefined) return cached;
  const rendered = renderAgentContext(db);
  snapshots.set(conversationId, rendered);
  return rendered;
}

/** Xóa snapshot khi SOUL hoặc instructions đổi để lượt sau dùng nội dung mới. */
export function invalidateAllAgentContexts(): void {
  snapshots.clear();
}

/** Xóa snapshot khi hội thoại bị xóa để không giữ dữ liệu trong bộ nhớ. */
export function dropAgentContext(conversationId: string): void {
  snapshots.delete(conversationId);
}
