import { z } from "zod";

/**
 * Định dạng API của nhà cung cấp AI, phân biệt theo giao thức thay vì tên công ty.
 * Một nhà cung cấp có thể hỗ trợ nhiều định dạng trong compatibleApis.
 * `google-interactions` còn ở giai đoạn beta nên chưa thêm.
 */
export const aiProviderApiType = z.enum([
  "openai-responses",
  "openai-chat-completions",
  "anthropic",
  "google-generate-content",
]);
export type AiProviderApiType = z.infer<typeof aiProviderApiType>;

/** Endpoint mặc định của từng API type; dùng cho ô baseUrl và dự phòng khi lấy danh sách model. */
export const DEFAULT_BASE_URL: Record<AiProviderApiType, string | null> = {
  "openai-responses": "https://api.openai.com/v1",
  "openai-chat-completions": null, // Gateway tương thích tự quản lý phải nhập URL.
  anthropic: "https://api.anthropic.com/v1",
  "google-generate-content": "https://generativelanguage.googleapis.com/v1beta",
};

/** Tên hiển thị của từng API type. */
export const PROVIDER_TYPE_LABEL: Record<AiProviderApiType, string> = {
  "openai-responses": "OpenAI Responses",
  "openai-chat-completions": "OpenAI Chat Completions",
  anthropic: "Anthropic",
  "google-generate-content": "Gemini",
};

/**
 * URL theo API type của DeepSeek tích hợp sẵn. DeepSeek hỗ trợ Chat Completions,
 * Responses và Anthropic trên cùng host; từng SDK tự thêm đường dẫn.
 * DB lưu baseUrl null rồi suy ra theo type hiện tại qua resolveProviderBaseUrl.
 */
const DEEPSEEK_BASE_URL: Partial<Record<AiProviderApiType, string>> = {
  "openai-chat-completions": "https://api.deepseek.com",
  "openai-responses": "https://api.deepseek.com",
  anthropic: "https://api.deepseek.com/anthropic",
};

/** Xác định DeepSeek tích hợp sẵn, có baseUrl null trong DB và cần suy ra từ type. */
export function isDeepseekProvider(p: { label: string | null; isBuiltin: boolean }): boolean {
  return p.isBuiltin && p.label === "DeepSeek";
}

/**
 * URL có hiệu lực cho một provider và API type; main factory và biểu mẫu renderer dùng chung.
 * DeepSeek tích hợp: DB lưu null, URL suy ra theo type.
 * Các provider khác: dùng baseUrl đã lưu; null nghĩa là endpoint mặc định của type/SDK.
 */
export function resolveProviderBaseUrl(
  p: { label: string | null; isBuiltin: boolean; baseUrl: string | null },
  type: AiProviderApiType,
): string | null {
  if (isDeepseekProvider(p)) return DEEPSEEK_BASE_URL[type] ?? null;
  return p.baseUrl;
}

/** Đầu vào chỉ có provider ID, dùng chung cho reveal và remove. */
export const providerIdInput = z.object({ id: z.string().min(1) });
export type ProviderIdInput = z.infer<typeof providerIdInput>;

/** Đầu vào kiểm tra kết nối: provider ID và tên model cần thử. */
export const testProviderInput = z.object({ id: z.string().min(1), model: z.string().min(1) });
export type TestProviderInput = z.infer<typeof testProviderInput>;

/**
 * Tạo provider mới khi không có ID hoặc cập nhật provider có ID.
 * Bỏ qua apiKey: giữ khóa cũ khi cập nhật, không có khóa khi tạo mới.
 * Truyền chuỗi khác rỗng: thay khóa đang lưu. Không hỗ trợ xóa khóa bằng null/chuỗi rỗng;
 * muốn xóa toàn bộ bản ghi thì dùng remove.
 */
export const upsertProviderInput = z.object({
  id: z.string().min(1).optional(),
  type: aiProviderApiType,
  label: z.string().nullish(),
  baseUrl: z.string().min(1).nullish(),
  apiKey: z.string().min(1).optional(),
  models: z.array(z.string().min(1)).optional(),
});
export type UpsertProviderInput = z.infer<typeof upsertProviderInput>;
// Yêu cầu baseUrl của openai-chat-completions phụ thuộc isBuiltin:
// DeepSeek tích hợp có URL suy ra theo type dù DB lưu null. Vì vậy kiểm tra URL thực tế
// trong repository.upsertProvider qua resolveProviderBaseUrl, không refine ở schema này.

/** Dữ liệu provider gửi sang renderer chỉ chứa khóa đã che, không chứa khóa gốc hay bản mã. */
export interface ProviderDto {
  id: string;
  /** Định dạng API hiện dùng, phải thuộc compatibleApis. */
  type: AiProviderApiType;
  /** Các định dạng API hỗ trợ; provider tích hợp có nhiều lựa chọn thì được đổi type. */
  compatibleApis: AiProviderApiType[];
  label: string | null;
  baseUrl: string | null;
  /** null là chưa có khóa; giá trị khác null là bản xem trước đã che, ví dụ "sk-…1234". */
  keyMask: string | null;
  models: string[];
  /** Provider tích hợp từ DEFAULT_PROVIDERS: không sửa tên/URL hay xóa; chỉ đổi type hợp lệ. */
  isBuiltin: boolean;
  createdAt: number;
}

/** Khóa gốc tạm thời trả về cho thao tác hiển thị trong UI. */
export const revealResult = z.object({ apiKey: z.string() });
export type RevealResult = z.infer<typeof revealResult>;

/** Đầu vào lấy model: ưu tiên apiKey đang nhập, nếu thiếu thì đọc khóa đã lưu theo ID. */
export const listModelsInput = z.object({
  type: aiProviderApiType,
  baseUrl: z.string().min(1).nullish(),
  apiKey: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});
export type ListModelsInput = z.infer<typeof listModelsInput>;

/** Kết quả lấy model: thành công có models; thất bại có message, chỉ lỗi HTTP mới có status. */
export const listModelsResult = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), models: z.array(z.string()) }),
  z.object({ ok: z.literal(false), status: z.number().int().optional(), message: z.string() }),
]);
export type ListModelsResult = z.infer<typeof listModelsResult>;

/** Kết quả kiểm tra kết nối. */
export const testResult = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), status: z.number().int().optional(), message: z.string() }),
]);
export type TestResult = z.infer<typeof testResult>;
