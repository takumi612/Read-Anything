import { z } from "zod";

/** Cấu hình backend tìm kiếm: exa-mcp là mẫu Exa, mcp là server Streamable HTTP tùy chọn. */
export const webSearchBackend = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exa-mcp"),
    label: z.string().optional(),
    apiKey: z.string().optional(),
    /** Renderer-only indicator; the saved secret is never returned to the UI. */
    hasApiKey: z.boolean().optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("mcp"),
    label: z.string().optional(),
    url: z.string().url(),
    toolName: z.string().min(1),
    apiKeyHeader: z.string().optional(),
    apiKey: z.string().optional(),
    hasApiKey: z.boolean().optional(),
    enabled: z.boolean().optional(),
  }),
]);
export type WebSearchBackendConfig = z.infer<typeof webSearchBackend>;

/** Thứ tự backends là thứ tự thử khi lỗi; công cụ chỉ đăng ký khi có backend. */
export const webSearchConfig = z.object({
  backends: z.array(webSearchBackend),
});
export type WebSearchConfig = z.infer<typeof webSearchConfig>;

/** Mặc định dùng Exa miễn phí, có thể dùng không cần khóa. */
export const DEFAULT_WEB_SEARCH: WebSearchConfig = {
  backends: [{ kind: "exa-mcp" }],
};

/** Remove secrets before passing search settings to the renderer. */
export function redactWebSearchKeys(config: WebSearchConfig): WebSearchConfig {
  return {
    backends: config.backends.map(({ apiKey, hasApiKey, ...backend }) => ({
      ...backend,
      hasApiKey: Boolean(apiKey) || Boolean(hasApiKey),
    })),
  };
}
