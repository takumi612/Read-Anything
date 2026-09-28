// src/main/ai/prompt-caching.ts
import type { ModelMessage, SystemModelMessage } from "ai";
import type { AiProviderApiType } from "@shared/providers";

/**
 * Prompt caching có hai cách tùy provider:
 * - Cache tường minh như Anthropic: đánh dấu điểm dừng bằng providerOptions.
 * - Cache ngầm như OpenAI Responses, các endpoint compatible và Gemini: server tự cache tiền tố dài.
 *
 * Tách vị trí đặt điểm dừng khỏi marker riêng của provider. breakpointStrategy quyết định
 * bố cục chung; STRATEGIES khai báo marker cần dùng. Provider cache ngầm giữ nguyên prompt.
 * Các hàm thuần túy, không phụ thuộc Electron hoặc mạng.
 */

type CacheProviderOptions = NonNullable<SystemModelMessage["providerOptions"]>;

export interface CachingInput {
  providerType: AiProviderApiType | undefined;
  system: string | undefined;
  messages: ModelMessage[];
}

export interface CachingResult {
  /** Dùng làm system của streamText; provider cache tường minh nhận thêm providerOptions. */
  system: string | SystemModelMessage | undefined;
  messages: ModelMessage[];
}

/** Một chiến lược cache nhận system/messages và trả lại sau khi có thể thêm điểm dừng. */
export type CachingStrategy = (args: {
  system: string | undefined;
  messages: ModelMessage[];
}) => CachingResult;

/**
 * Bố cục chung của cache tường minh:
 * - Một điểm cố định ở system; thứ tự tools → system → messages cho phép dùng lại tiền tố.
 *   Truyền SystemModelMessage qua tham số system của streamText để có providerOptions.
 * - Một điểm cuốn chiếu ở mỗi lượt người dùng trong hai lượt cuối; lookback giúp lượt trước còn hit.
 *
 * Tổng cộng không quá ba điểm, dưới mức giới hạn bốn. Marker là providerOptions riêng:
 * Anthropic dùng cacheControl; Bedrock có thể dùng cachePoint mà không đổi bố cục.
 */
export function breakpointStrategy(marker: CacheProviderOptions): CachingStrategy {
  return ({ system, messages }) => {
    const taggedSystem: string | SystemModelMessage | undefined =
      system != null ? { role: "system", content: system, providerOptions: marker } : undefined;

    const out = [...messages];
    const userIndices = out.flatMap((m, i) => (m.role === "user" ? [i] : []));
    for (const i of userIndices.slice(-2)) {
      const m = out[i];
      out[i] = { ...m, providerOptions: { ...m.providerOptions, ...marker } } as ModelMessage;
    }
    return { system: taggedSystem, messages: out };
  };
}

/**
 * Ánh xạ provider sang chiến lược cache tường minh. Provider vắng mặt dùng cache ngầm
 * của server và withPromptCaching trả nguyên dữ liệu; thêm provider mới tại đây.
 */
const STRATEGIES: Partial<Record<AiProviderApiType, CachingStrategy>> = {
  anthropic: breakpointStrategy({ anthropic: { cacheControl: { type: "ephemeral" } } }),
};

/** Áp dụng chiến lược cache theo provider trước streamText; nếu cache ngầm thì trả nguyên prompt. */
export function withPromptCaching(input: CachingInput): CachingResult {
  const strategy = input.providerType ? STRATEGIES[input.providerType] : undefined;
  if (!strategy) return { system: input.system, messages: input.messages };
  return strategy({ system: input.system, messages: input.messages });
}
