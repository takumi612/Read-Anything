import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@main/logger";
import { SearchService } from "@main/ai/search/search-service";
import { makeMcpBackend, backendOptsFor } from "@main/ai/search/mcp-backend";
import type { WebSearchConfig } from "@shared/web-search";

const log = createLogger("search");

/**
 * Trả lỗi công cụ thành `{ error }` để không ngắt luồng trả lời;
 * model có thể đọc lỗi và thử lại với tham số khác.
 */
async function runTool<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    log.warn(`tool ${name} failed (error returned to model for self-correction)`, err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Tạo công cụ web_search.
 * @param service Dịch vụ tìm kiếm được truyền vào để có thể kiểm thử.
 * @param turnEnabled Lượt này có cho tìm kiếm mạng không; false trả lỗi nhẹ, không gọi service.
 */
export function makeWebSearchTool(service: SearchService, turnEnabled: boolean) {
  return tool({
    description:
      "Search the web for current or external information not contained in the book " +
      "(recent events, facts beyond the text, background). Returns ranked results " +
      "with title, url and snippet.",
    inputSchema: z.object({
      query: z.string().min(1),
      numResults: z.number().int().min(1).max(10).optional(),
    }),
    execute: ({ query, numResults }) =>
      runTool("web_search", async () => {
        if (!turnEnabled) {
          throw new Error(
            "Web search is turned off for this message. Answer from available context, or tell the user to enable web search for this message.",
          );
        }
        const results = await service.search(query, { numResults });
        return { results };
      }),
  });
}

/**
 * Tạo công cụ và hàm dọn tài nguyên theo cài đặt tìm kiếm mạng.
 * Bên gọi phải close() sau khi luồng AI kết thúc để giải phóng kết nối MCP.
 */
export function createSearchTools(cfg: WebSearchConfig, turnEnabled: boolean) {
  const backends = cfg.backends
    .filter((b) => b.enabled !== false)
    .map((b) => makeMcpBackend(backendOptsFor(b)));
  const service = new SearchService(backends);
  return {
    tools: { web_search: makeWebSearchTool(service, turnEnabled) },
    close: () => service.close(),
  };
}
