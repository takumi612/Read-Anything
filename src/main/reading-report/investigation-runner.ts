// Nối logic điều tra hội thoại với model thật và giới hạn tác vụ nền.
import { generateText } from "ai";
import type { ResolvedModel } from "@main/ai/assistant-model";
import { acquireSlot, type RunBackground } from "@main/ai/background-limiter";
import { providerCallOptions } from "@main/ai/model-factory";
import type { DB } from "@main/db/client";
import type { ReadingSessionRow } from "@main/reading-sessions/repository";
import { readSessionConversation } from "@main/reading-report/evidence";
import {
  investigateConversation,
  INVESTIGATION_SLOT_TIMEOUT_MS,
  INVESTIGATION_SYSTEM,
  type ConversationInvestigation,
} from "@main/reading-report/investigator";

export interface InvestigatorDeps {
  db: DB;
  session: ReadingSessionRow;
  resolved: Extract<ResolvedModel, { ok: true }>;
  runBackground: RunBackground;
  abortSignal: AbortSignal;
}

export type Investigate = (input: {
  conversationId: string;
  focus?: string;
}) => Promise<ConversationInvestigation | null>;

/**
 * Mỗi lần điều tra chiếm một suất tác vụ nền toàn cục, nên giới hạn người dùng đặt có hiệu lực.
 * Báo cáo chính là tác vụ foreground, không chiếm suất này. Chờ quá lâu thì trả null
 * để công cụ báo busy và tác vụ chính tự đọc trang.
 */
export function createInvestigator(deps: InvestigatorDeps): Investigate {
  return async ({ conversationId, focus }) => {
    const slot = await acquireSlot(deps.runBackground, INVESTIGATION_SLOT_TIMEOUT_MS);
    if (!slot.ok) return null;
    try {
      return await investigateConversation({
        focus,
        readPage: (options) =>
          readSessionConversation(deps.db, deps.session, conversationId, options),
        generate: async (prompt) => {
          const { text } = await generateText({
            model: deps.resolved.model,
            reasoning: deps.resolved.reasoningEffort,
            instructions: INVESTIGATION_SYSTEM,
            prompt,
            providerOptions: providerCallOptions(deps.resolved.providerType),
            abortSignal: deps.abortSignal,
            // Không đặt maxOutputTokens vì model reasoning dùng chung mức đó cho suy luận và nội dung.
            maxRetries: 1,
          });
          return text;
        },
      });
    } finally {
      slot.release();
    }
  };
}
