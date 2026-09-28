import { APICallError, LoadAPIKeyError, generateText } from "ai";
import { resolveLanguageModel, type ChatModel } from "@main/ai/model-factory";
import type { ProviderTestParams, ProviderTester } from "@main/secrets/tester";
import type { TestResult } from "@shared/providers";
import { t } from "@main/i18n";
import { createLogger } from "@main/logger";

const log = createLogger("providers");

/** Gửi một yêu cầu tạo văn bản tối thiểu tới model; có thể thay bằng mock khi kiểm thử. */
export type GenerateProbe = (model: ChatModel) => Promise<void>;

const realProbe: GenerateProbe = async (model) => {
  // maxOutputTokens phải đủ cho model reasoning. Nếu đặt 1, model có thể trả HTTP 200
  // nhưng kết quả incomplete và AI SDK báo lỗi phân tích. 64 token cho mức suy luận tối thiểu.
  await generateText({ model, prompt: "ping", maxOutputTokens: 64, maxRetries: 0 });
};

/**
 * Cố lấy thông điệp lỗi thật từ body provider ở các dạng phổ biến.
 * Body không phải JSON hoặc không có message thì trả null; bên gọi dùng mã HTTP
 * để nêu khả năng lỗi thay vì tự đoán nguyên nhân cụ thể.
 */
export function getErrorMessage(err: unknown): string | null {
  if (!APICallError.isInstance(err) || typeof err.responseBody !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(err.responseBody);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const error = obj.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error !== null && typeof error === "object") {
    const msg = (error as Record<string, unknown>).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  return null;
}

/** Nếu thiếu lời lỗi của provider, diễn giải mã HTTP như hướng kiểm tra có thể đúng. */
const HTTP_HINT: Record<number, string> = {
  400: "Bad Request — the request or model name may be rejected",
  401: "Unauthorized — the API key may be invalid or missing",
  403: "Forbidden — access denied; possibly insufficient permissions or a region/network restriction",
  404: "Not Found — the model name or endpoint may be wrong",
  429: "Too Many Requests — rate limited or quota exhausted",
};

function describeFallback(status: number | undefined, err: unknown): string {
  if (status === undefined) {
    // Lỗi mạng hoặc phân tích không có HTTP response: chuyển nguyên thông điệp lỗi.
    return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (HTTP_HINT[status]) return `HTTP ${status}: ${HTTP_HINT[status]}`;
  if (status >= 500) return `HTTP ${status}: the provider had a server-side error`;
  if (status >= 200 && status < 300) {
    // HTTP 2xx vẫn có thể lỗi nếu AI SDK không phân tích được phản hồi, thường do
    // model reasoning thiếu token đầu ra. Dùng thông điệp SDK thay vì "HTTP 200" mơ hồ.
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    return `HTTP ${status}: the provider returned a success status but the response could not be parsed${detail}`;
  }
  return `HTTP ${status}`;
}

/**
 * Chuyển ngoại lệ thành TestResult: ưu tiên lời lỗi thật của provider;
 * nếu thiếu thì dùng ý nghĩa mã HTTP như một hướng kiểm tra, không tự bịa nguyên nhân.
 */
export function mapTestError(err: unknown): TestResult {
  if (LoadAPIKeyError.isInstance(err)) {
    return { ok: false, message: t("errors.noApiKeyConfigured", "Chưa cấu hình API key") };
  }
  const status = APICallError.isInstance(err) ? err.statusCode : undefined;
  return { ok: false, status, message: getErrorMessage(err) ?? describeFallback(status, err) };
}

/** ProviderTester dùng AI SDK generateText; có thể truyền probe khác trong kiểm thử. */
export function createAiSdkTester(probe: GenerateProbe = realProbe): ProviderTester {
  return {
    async test(params: ProviderTestParams): Promise<TestResult> {
      let model: ChatModel;
      try {
        model = resolveLanguageModel(params);
      } catch (err) {
        log.warn("testProvider: model resolution failed", err);
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
      try {
        await probe(model);
        return { ok: true };
      } catch (err) {
        // Khi chuyển lỗi thành TestResult, vẫn ghi cảnh báo để có dấu vết chẩn đoán.
        log.warn("provider connectivity test failed", err);
        return mapTestError(err);
      }
    },
  };
}

/** Singleton của main process, được truyền vào repository. */
export const aiSdkTester: ProviderTester = createAiSdkTester();
