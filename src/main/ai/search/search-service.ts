import { createLogger } from "@main/logger";
import type { SearchBackend, SearchHit } from "@main/ai/search/types";

const log = createLogger("search");

/**
 * Thử backend tìm kiếm theo thứ tự, trả kết quả đầu tiên thành công.
 * Nếu tất cả lỗi, ném lỗi tổng hợp để công cụ web_search chuyển thành kết quả lỗi nhẹ.
 */
export class SearchService {
  constructor(private readonly backends: SearchBackend[]) {}

  async search(query: string, opts: { numResults?: number }): Promise<SearchHit[]> {
    let lastErr: unknown;
    for (const b of this.backends) {
      try {
        return await b.search(query, opts);
      } catch (err) {
        lastErr = err;
        log.warn(`search backend ${b.id} failed, falling back`, err);
      }
    }
    throw new Error("all web search backends failed", { cause: lastErr });
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.backends.map((b) => b.close()));
  }
}
