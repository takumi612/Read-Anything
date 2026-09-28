import { z } from "zod";
import { DEFAULT_BASE_URL, type AiProviderApiType } from "@shared/providers";
import { t } from "@main/i18n";

export interface ModelsRequest {
  url: string;
  headers: Record<string, string>;
}

/** Tạo yêu cầu /models theo API type, gồm URL và header xác thực. */
export function buildModelsRequest(
  type: AiProviderApiType,
  baseUrl: string | null,
  apiKey: string,
): ModelsRequest {
  const raw = baseUrl ?? DEFAULT_BASE_URL[type];
  if (!raw)
    throw new Error(t("errors.baseUrlRequiredForProvider", "$t(terms.provider) này cần có baseUrl"));
  // baseUrl đã có đoạn phiên bản như /v1 hoặc /v1beta; chỉ thêm /models.
  // Bỏ dấu / cuối để tránh //models, nhất quán với URL dùng khi tạo model.
  const base = raw.replace(/\/+$/, "");
  switch (type) {
    case "openai-responses":
    case "openai-chat-completions":
      return { url: `${base}/models`, headers: { Authorization: `Bearer ${apiKey}` } };
    case "anthropic":
      return {
        url: `${base}/models`,
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      };
    case "google-generate-content":
      return { url: `${base}/models?key=${encodeURIComponent(apiKey)}`, headers: {} };
  }
}

const openaiLike = z.object({ data: z.array(z.object({ id: z.string() })) });
const googleSchema = z.object({
  models: z.array(
    z.object({ name: z.string(), supportedGenerationMethods: z.array(z.string()).optional() }),
  ),
});
const looseItem = z.object({ id: z.string() }).passthrough();

/**
 * Các dấu hiệu chắc chắn của model không tạo văn bản: ảnh, TTS, chuyển giọng nói,
 * embedding, rerank, moderation và video. Chỉ loại tên khớp ở ranh giới từ.
 * Model chưa biết vẫn được giữ để người dùng tự chọn, tránh bỏ sót model chat mới.
 * Google được lọc theo khả năng generateContent thay vì danh sách này.
 */
const NON_TEXT_MODEL =
  /(^|[-/])(dall-e|gpt-image|tts|whisper|transcribe|embed|rerank|moderation|sora)/i;

/** Bỏ model chắc chắn không dùng để tạo văn bản khỏi danh sách ID. */
function filterTextModels(ids: string[]): string[] {
  return ids.filter((id) => !NON_TEXT_MODEL.test(id));
}

export interface FetchModelsParams {
  type: AiProviderApiType;
  baseUrl: string | null;
  apiKey: string;
}

/** Diễn giải mã HTTP khi không có lời lỗi chi tiết; chỉ nêu nguyên nhân có thể xảy ra. */
const HTTP_HINT: Record<number, string> = {
  400: "Bad Request — the request may be rejected",
  401: "Unauthorized — the API key may be invalid or missing",
  403: "Forbidden — access denied",
  404: "Not Found — the endpoint or base URL may be wrong",
  429: "Too Many Requests — rate limited or quota exhausted",
};

/** Chuyển lỗi thành thông điệp dễ đọc; ưu tiên thông điệp gốc của provider. */
export function mapModelsError(
  err: unknown,
  status: number | undefined,
): { status?: number; message: string } {
  // Chỉ dùng Error.message hoặc chuỗi gốc; dữ liệu khác dùng thông điệp theo mã HTTP.
  const fromErr = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (fromErr) return { status, message: fromErr };
  if (status && HTTP_HINT[status])
    return { status, message: `HTTP ${status}: ${HTTP_HINT[status]}` };
  if (status && status >= 500)
    return { status, message: `HTTP ${status}: the provider had a server-side error` };
  if (status) return { status, message: `HTTP ${status}` };
  return { message: t("errors.requestFailed", "Yêu cầu thất bại") };
}

/** Lấy message thật từ body lỗi ở các dạng phổ biến; không có thì trả null. */
function extractBodyMessage(body: unknown): string | null {
  if (body === null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const e = o.error;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const m = (e as Record<string, unknown>).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (typeof o.message === "string" && o.message.trim()) return o.message;
  return null;
}

/** Gọi endpoint /models và trả danh sách ID; lỗi chứa thông điệp provider hoặc diễn giải HTTP. */
export async function fetchProviderModels(
  p: FetchModelsParams,
  fetchImpl: typeof fetch,
): Promise<string[]> {
  const req = buildModelsRequest(p.type, p.baseUrl, p.apiKey);
  const res = await fetchImpl(req.url, { method: "GET", headers: req.headers });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const message = extractBodyMessage(body) ?? mapModelsError(undefined, res.status).message;
    throw new Error(message);
  }
  return adaptModelsResponse(p.type, body);
}

/** Kiểm tra phản hồi ngoài bằng Zod rồi chuẩn hóa danh sách model theo type. */
export function adaptModelsResponse(type: AiProviderApiType, json: unknown): string[] {
  if (type === "google-generate-content") {
    return (
      googleSchema
        .parse(json)
        // Thiếu supportedGenerationMethods thì vẫn giữ model để người dùng thử.
        .models.filter((m) => m.supportedGenerationMethods?.includes("generateContent") ?? true)
        .map((m) => m.name.replace(/^models\//, ""))
    );
  }
  if (type === "openai-chat-completions") {
    const data = (json as { data?: unknown })?.data;
    if (!Array.isArray(data)) return [];
    const ids = data.flatMap((it) => {
      const p = looseItem.safeParse(it);
      return p.success ? [p.data.id] : [];
    });
    return filterTextModels(ids);
  }
  // OpenAI Responses và Anthropic chỉ chấp nhận data[].id hợp lệ.
  return filterTextModels(openaiLike.parse(json).data.map((m) => m.id));
}
