/**
 * Backend tìm kiếm MCP: gọi công cụ từ xa như Exa qua giao thức Streamable HTTP MCP.
 *
 * API của @modelcontextprotocol/sdk 1.29.0, đối chiếu từ định nghĩa kiểu:
 *   - new Client({ name, version }, options?)
 *   - client.connect(transport, requestOptions?)
 *   - client.callTool({ name, arguments }, resultSchema?, requestOptions?)
 *   - new StreamableHTTPClientTransport(url: URL, opts?: { requestInit?: RequestInit, ... })
 *     → requestInit.headers chứa header tùy chỉnh, gồm API key.
 */
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createLogger } from "@main/logger";
import type { SearchBackend, SearchHit } from "@main/ai/search/types";
import type { WebSearchBackendConfig } from "@shared/web-search";

const log = createLogger("search");

/** Tham số cần để tạo backend MCP. */
export interface McpBackendOpts {
  id: string;
  url: string;
  toolName: string;
  headers: Record<string, string>;
  mapResult: (raw: unknown) => SearchHit[];
}

const EXA_MCP_URL = "https://mcp.exa.ai/mcp?tools=web_search_exa";

const exaResultSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
});

/**
 * Chuyển kết quả MCP callTool thành SearchHit[].
 *
 * Định dạng trả về của Exa MCP web_search_exa đã kiểm tra; không có structuredContent:
 *   { content: [{ type:"text", text: <formatted plain text> }] }
 *
 * Các khối kết quả cách nhau bằng --- và có định dạng:
 *   Title: <title>
 *   URL: <url>
 *   Published: <ngày ISO | N/A>
 *   Author: <name | N/A>
 *   Highlights:
 *   <văn bản nổi bật có thể nhiều dòng>
 */
export function mapExaResult(raw: unknown): SearchHit[] {
  // Kiểm tra envelope; lỗi để SearchService dùng đường dự phòng.
  const { content } = exaResultSchema.parse(raw);
  const text = content[0]!.text;

  // Dấu --- nằm trên một dòng riêng; chấp nhận khoảng trắng hai bên.
  const blocks = text.split(/\n[ \t]*-{3,}[ \t]*\n/);

  const hits: SearchHit[] = [];
  for (const block of blocks) {
    try {
      const titleMatch = /^Title:\s*(.+)$/m.exec(block);
      const urlMatch = /^URL:\s*(.+)$/m.exec(block);
      const publishedMatch = /^Published:\s*(.+)$/m.exec(block);
      const highlightsMatch = /^Highlights:\s*\n([\s\S]*)$/m.exec(block);

      const url = urlMatch?.[1]?.trim();
      if (!url) continue; // Bỏ kết quả không có URL.

      const title = titleMatch?.[1]?.trim() || url;
      const publishedRaw = publishedMatch?.[1]?.trim();
      const publishedDate = publishedRaw && publishedRaw !== "N/A" ? publishedRaw : undefined;

      // Gộp dòng trống, bỏ khoảng trắng hai đầu và giới hạn highlight ở 600 ký tự.
      const highlightText = highlightsMatch?.[1] ?? "";
      const snippet = highlightText
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 600);

      hits.push({ title, url, snippet, ...(publishedDate ? { publishedDate } : {}) });
    } catch {
      // Một khối lỗi không ảnh hưởng các khối còn lại.
    }
  }
  return hits;
}

/** Tạo cấu hình Exa MCP; apiKey tùy chọn vì gói miễn phí có thể dùng không cần khóa. */
export function exaBackendOpts(apiKey?: string): McpBackendOpts {
  return {
    id: "exa-mcp",
    url: EXA_MCP_URL,
    toolName: "web_search_exa",
    headers: apiKey ? { "x-api-key": apiKey } : {},
    mapResult: mapExaResult,
  };
}

/**
 * Tạo cấu hình MCP chung với header và tên công cụ tùy chỉnh.
 *
 * Server `kind:"mcp"` khác dùng lại mapExaResult, nên cần trả văn bản theo dạng Exa:
 * các khối cách nhau bằng ---, mỗi khối có Title/URL/Published/Highlights.
 * Backend trả dạng khác cần hàm mapResult riêng trong lần mở rộng sau.
 */
export function genericBackendOpts(
  cfg: Extract<WebSearchBackendConfig, { kind: "mcp" }>,
): McpBackendOpts {
  const header = cfg.apiKeyHeader ?? "x-api-key";
  return {
    id: `mcp:${new URL(cfg.url).host}`,
    url: cfg.url,
    toolName: cfg.toolName,
    headers: cfg.apiKey ? { [header]: cfg.apiKey } : {},
    mapResult: mapExaResult,
  };
}

/** Chọn cách tạo tùy chọn backend từ cấu hình người dùng. */
export function backendOptsFor(cfg: WebSearchBackendConfig): McpBackendOpts {
  return cfg.kind === "exa-mcp" ? exaBackendOpts(cfg.apiKey) : genericBackendOpts(cfg);
}

/**
 * Tạo MCP SearchBackend kết nối khi cần: search() đầu tiên mở kết nối,
 * close() giải phóng tài nguyên.
 */
export function makeMcpBackend(opts: McpBackendOpts): SearchBackend {
  let client: Client | undefined;
  let connecting: Promise<Client> | undefined;

  async function ensure(): Promise<Client> {
    if (client) return client;
    if (!connecting) {
      connecting = (async () => {
        try {
          const c = new Client({ name: "read-anything", version: "0.1.0" });
          const transport = new StreamableHTTPClientTransport(new URL(opts.url), {
            requestInit: { headers: opts.headers },
          });
          await c.connect(transport);
          client = c;
          return c;
        } finally {
          connecting = undefined;
        }
      })();
    }
    return connecting;
  }

  return {
    id: opts.id,
    async search(query, { numResults }) {
      const c = await ensure();
      const raw = await c.callTool({
        name: opts.toolName,
        arguments: { query, ...(numResults != null ? { numResults } : {}) },
      });
      return opts.mapResult(raw);
    },
    async close() {
      if (client) {
        try {
          await client.close();
        } catch (err) {
          log.warn(`mcp backend ${opts.id} close failed`, err);
        }
        client = undefined;
      }
    },
  };
}
