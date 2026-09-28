import { generateText, isStepCount, type ToolSet } from "ai";
import type { ResolvedModel } from "@main/ai/assistant-model";
import { providerCallOptions } from "@main/ai/model-factory";
import { createLogger } from "@main/logger";

const log = createLogger("report");

/**
 * Giữ giới hạn bước công cụ để model không kẹt trong vòng đọc trang.
 * Cần đủ bước cho liệt kê, điều tra nhiều hội thoại, đọc lại bằng chứng và viết báo cáo.
 */
export const REPORT_AGENT_MAX_STEPS = 40;

export interface RunReadingReportAgentInput {
  resolved: Extract<ResolvedModel, { ok: true }>;
  tools: ToolSet;
  instructions: string;
  bookTitle: string | null;
  startedAt: number;
  completedAt: number;
  activeSeconds: number;
  abortSignal: AbortSignal;
}

export async function runReadingReportAgent(input: RunReadingReportAgentInput): Promise<string> {
  const result = await generateText({
    model: input.resolved.model,
    reasoning: input.resolved.reasoningEffort,
    instructions: input.instructions,
    prompt: `Write the completion report for ${input.bookTitle ?? "this book"}. This reading ran from ${input.startedAt} to ${input.completedAt} and has ${input.activeSeconds} active reading seconds. Inspect all reader traces before writing; conversation evidence is paginated.`,
    tools: input.tools,
    providerOptions: providerCallOptions(input.resolved.providerType),
    abortSignal: input.abortSignal,
    stopWhen: isStepCount(REPORT_AGENT_MAX_STEPS),
    // Không đặt maxOutputTokens: model reasoning dùng chung ngân sách cho suy luận và văn bản.
    // Mức quá thấp có thể hết token trước khi báo cáo được viết.
    maxRetries: 1,
    onStepFinish: ({ finishReason, toolCalls, text }) => {
      log.debug(
        `step finished (finishReason=${finishReason}, toolCalls=${toolCalls.length}, textChars=${text.length})`,
      );
    },
  });
  const text = result.text.trim();
  if (!text) throw new Error("reading report agent returned empty text");
  return text;
}
