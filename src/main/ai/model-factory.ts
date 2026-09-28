import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4, SharedV4ProviderOptions } from "@ai-sdk/provider";
import type { AiProviderApiType } from "@shared/providers";

/**
 * Kiểu model của AI SDK: bốn factory provider đều trả LanguageModelV4 của @ai-sdk/provider.
 * Dùng trực tiếp giao diện này cho generateText/streamText, tránh lệch kiểu khi @ai-sdk/openai nâng bản.
 */
export type ChatModel = LanguageModelV4;

export interface ResolveModelParams {
  type: AiProviderApiType;
  baseUrl: string | null;
  apiKey: string;
  model: string;
}

/**
 * Hàm fetch dùng cho cả tiến trình. Main truyền Electron net.fetch để các provider
 * dùng mạng Chromium và proxy hệ thống. Nếu chưa truyền, SDK tự dùng global fetch.
 * Factory là điểm tạo model chung cho kiểm tra kết nối và gửi chat.
 */
let injectedFetch: typeof globalThis.fetch | undefined;

/** Main gọi một lần sau app.ready; truyền undefined để đặt lại trong kiểm thử. */
export function setModelFetch(fetchImpl: typeof globalThis.fetch | undefined): void {
  injectedFetch = fetchImpl;
}

/**
 * Kiểm tra provider có hỗ trợ ảnh trong kết quả công cụ không (spec §7).
 * openai-chat-completions qua SDK compatible chỉ nhận văn bản trong tin nhắn tool;
 * các SDK còn lại chuyển file-data thành định dạng ảnh riêng.
 * providerType không có trong mock kiểm thử thì coi như không hỗ trợ.
 * Không lập danh sách model nhìn được ảnh theo tên vì model mới dễ bị bỏ sót;
 * nếu gọi ảnh thất bại, lỗi thật được trả về để model có thể thử dạng text.
 */
export function supportsImageToolResults(type?: AiProviderApiType): boolean {
  return type === "anthropic" || type === "google-generate-content" || type === "openai-responses";
}

/**
 * providerOptions kèm mỗi lần gọi streamText/generateText; thiếu thì trả undefined.
 *
 * Với openai-responses, buộc `store: false`. Nhiều gateway trung gian không lưu reasoning item
 * của Responses API. AI SDK mặc định store:true và có thể gửi lại item_reference của bước trước;
 * gateway không lưu item đó sẽ báo lỗi "Item with id 'rs_…' not found".
 * Khi store:false, SDK gửi reasoning đã mã hóa ngay trong yêu cầu tiếp theo; nếu endpoint không
 * trả encrypted_content, SDK bỏ phần reasoning ấy thay vì làm hỏng vòng gọi công cụ.
 * Endpoint OpenAI chính thức cũng hỗ trợ cách này.
 */
export function providerCallOptions(type?: AiProviderApiType): SharedV4ProviderOptions | undefined {
  if (type === "openai-responses") return { openai: { store: false } };
  return undefined;
}

/** Tạo model AI SDK từ cấu hình provider và tên model; kiểm tra kết nối và chat dùng chung. */
export function resolveLanguageModel(p: ResolveModelParams): ChatModel {
  const withBase = (base: string | null) => (base ? { baseURL: base } : {});
  const fetch = injectedFetch;
  switch (p.type) {
    case "openai-responses":
      return createOpenAI({ apiKey: p.apiKey, fetch, ...withBase(p.baseUrl) })(p.model);
    case "anthropic":
      return createAnthropic({ apiKey: p.apiKey, fetch, ...withBase(p.baseUrl) })(p.model);
    case "google-generate-content":
      return createGoogle({ apiKey: p.apiKey, fetch, ...withBase(p.baseUrl) })(p.model);
    case "openai-chat-completions": {
      if (!p.baseUrl) throw new Error("openai-chat-completions provider requires a baseUrl");
      // Endpoint DeepSeek chính thức dùng @ai-sdk/deepseek dù cùng giao thức chat completions.
      // SDK này ánh xạ insufficient_system_resource thành finishReason "error" và đọc
      // reasoning_content cùng số token cache; SDK compatible không cung cấp đủ thông tin đó.
      // Gateway tương thích khác vẫn dùng openai-compatible.
      const normalized = p.baseUrl.replace(/\/+$/, "");
      if (/^https:\/\/api\.deepseek\.com(\/v1)?$/.test(normalized)) {
        return createDeepSeek({ apiKey: p.apiKey, fetch, baseURL: p.baseUrl })(p.model);
      }
      return createOpenAICompatible({
        name: "openai-chat-completions",
        apiKey: p.apiKey,
        fetch,
        baseURL: p.baseUrl,
      })(p.model);
    }
  }
}
