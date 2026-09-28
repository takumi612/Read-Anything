// src/renderer/query/conversation-queries.ts
import type { ConversationDto } from "@shared/chat";
import { qk } from "@renderer/query/keys";
import { type ChatContext, contextKey } from "@renderer/ai/chat-context";

type IntervalQuery = { state: { data?: ConversationDto[] } };

/** Truy vấn danh sách hội thoại theo context: book dùng bookId, library dùng null; khóa phân biệt bằng contextKey. */
export function conversationsQuery(ctx: ChatContext) {
  const bookId = ctx.kind === "book" ? ctx.bookId : null;
  return {
    queryKey: qk.conversations(contextKey(ctx)),
    queryFn: (): Promise<ConversationDto[]> => window.api.chat.conversations.listByBook({ bookId }),
    staleTime: 0,
    refetchInterval: (q: IntervalQuery) => (q.state.data?.some((c) => c.isNaming) ? 1200 : false),
  } as const;
}
