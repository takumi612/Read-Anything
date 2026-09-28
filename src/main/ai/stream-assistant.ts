// src/main/ai/stream-assistant.ts
import {
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessageChunk,
} from "ai";
import { eq } from "drizzle-orm";
import { conversations } from "@main/db/schema";
import { createContextTools } from "@main/ai/context-tools";
import { createMemoryTools } from "@main/ai/memory-tools";
import { providerCallOptions, supportsImageToolResults } from "@main/ai/model-factory";
import { withPromptCaching } from "@main/ai/prompt-caching";
import { maybeCompactConversation } from "@main/ai/context-compaction";
import { maybeConsolidateMemory } from "@main/ai/memory-consolidation";
import { nameConversation } from "@main/chat/conversation-title";
import { appendMessage } from "@main/chat/messages";
import { textOfParts } from "@main/ai/prompt";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { SendDeps } from "@main/ai/send";
import { DEFAULT_STEP_LIMIT } from "@shared/preferences";
import { createLogger } from "@main/logger";

const log = createLogger("send");

type ResolvedOk = Extract<ResolvedModel, { ok: true }>;

/** Kiểu kết quả thành công chung cho runSend và runResend. */
export interface OkSendResult {
  ok: true;
  conversationId: string;
  /** Luồng UIMessageChunk để đẩy qua IPC tới UI. */
  stream: AsyncIterable<UIMessageChunk>;
  finished: Promise<void>;
}

export interface StreamCtx {
  conversationId: string;
  bookId: string | null;
  resolved: ResolvedOk;
  /** Văn bản lượt người dùng hiện tại, dùng khi tự đặt tên hội thoại. */
  userText: string;
  webSearchTurn: boolean;
}

/**
 * Phần xử lý stream dùng chung: streamText cùng công cụ chạy vòng AI,
 * lưu trạng thái cuối complete/error/aborted, đặt tên lượt đầu và nén sau lượt.
 */
export function streamAssistantReply(
  deps: SendDeps,
  ctx: StreamCtx,
  messages: ModelMessage[],
  systemPrompt: string | undefined,
  opts?: { abortSignal?: AbortSignal },
): OkSendResult {
  const { db, loadBytes, resolveSummaryModel, stepLimit, runBackground, notify } = deps;
  const { conversationId, bookId, resolved } = ctx;
  const imageToolResults = supportsImageToolResults(resolved.providerType);
  const memoryTools = createMemoryTools({ db });

  let closeSearch: (() => Promise<unknown>) | undefined;
  const wsCfg = deps.webSearchConfig;
  const searchTools =
    deps.createSearchTools && wsCfg?.backends.length
      ? (() => {
          const s = deps.createSearchTools!(wsCfg, ctx.webSearchTurn);
          closeSearch = s.close;
          return s.tools;
        })()
      : {};

  const contextTools = createContextTools({ db, bookId, loadBytes, imageToolResults });
  const tools = {
    ...contextTools,
    ...Object.fromEntries(
      Object.entries(memoryTools).filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] != null,
      ),
    ),
    ...searchTools,
  };

  let capturedUsage: LanguageModelUsage | undefined;
  const limit = stepLimit ?? DEFAULT_STEP_LIMIT;
  // Áp dụng cache tường minh hoặc giữ nguyên prompt nếu provider tự cache.
  const cached = withPromptCaching({
    providerType: resolved.providerType,
    system: systemPrompt,
    messages,
  });
  const result = streamText({
    model: resolved.model,
    // reasoning cấp cao nhất của SDK v7; undefined dùng mặc định provider.
    reasoning: resolved.reasoningEffort,
    instructions: cached.system,
    messages: cached.messages,
    tools,
    providerOptions: providerCallOptions(resolved.providerType),
    stopWhen: limit === 0 ? () => false : isStepCount(limit),
    abortSignal: opts?.abortSignal,
    // SDK v7 dùng onEnd; usage là tổng của mọi bước trong lượt.
    onEnd: ({ usage }) => {
      capturedUsage = usage;
    },
    onStepEnd: ({ finishReason, toolCalls, text }) => {
      log.debug(
        `step finished (finishReason=${finishReason}, toolCalls=${toolCalls.length}, textChars=${text.length})`,
      );
    },
  });

  let resolveDone!: () => void;
  const finished = new Promise<void>((res) => {
    resolveDone = res;
  });

  let streamHadError = false;
  let errorInfo: { name: string; message: string } | undefined;
  const uiStream = toUIMessageStream({
    stream: result.stream,
    onError: (err) => {
      streamHadError = true;
      errorInfo = {
        name: err instanceof Error ? err.name : "Error",
        message: err instanceof Error ? err.message : String(err),
      };
      log.warn("stream/model error", err);
      return errorInfo.message;
    },
    onFinish: ({ responseMessage, isAborted }) => {
      const stillExists = db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .get();
      if (!stillExists) {
        log.debug("conversation deleted mid-stream; dropping assistant persist", conversationId);
        return;
      }
      const status = streamHadError ? "error" : isAborted ? "aborted" : "complete";
      const usage =
        capturedUsage?.inputTokens != null && capturedUsage.outputTokens != null
          ? { inputTokens: capturedUsage.inputTokens, outputTokens: capturedUsage.outputTokens }
          : undefined;
      appendMessage(db, {
        conversationId,
        role: "assistant",
        parts: responseMessage.parts,
        status,
        metadata: {
          model: resolved.modelId,
          usage,
          error: streamHadError ? errorInfo : undefined,
        },
      });
      if (status === "complete") {
        const assistantText = textOfParts(responseMessage.parts);
        const row = db
          .select({ title: conversations.title })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .get();
        if (assistantText && row && row.title == null) {
          void nameConversation(
            { db, resolveModel: resolveSummaryModel, runBackground },
            conversationId,
            ctx.userText,
            assistantText,
          );
        }
        void maybeCompactConversation(
          { db, resolveModel: resolveSummaryModel, runBackground },
          conversationId,
        );
        void maybeConsolidateMemory(
          { db, resolveModel: resolveSummaryModel, runBackground, notify },
          conversationId,
        );
      }
    },
  });

  const [internalStream, callerStream] = uiStream.tee();
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of internalStream) {
        // drain
      }
    } catch (err) {
      log.warn("assistant persist / stream drain failed", err);
    } finally {
      void closeSearch?.();
      resolveDone();
    }
  })();

  return { ok: true, conversationId, stream: callerStream, finished };
}
