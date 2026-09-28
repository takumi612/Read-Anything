// Trích và kiểm tra JSON từ văn bản tự do của model.
// Không dùng generateObject/response_format vì mức hỗ trợ khác nhau giữa provider;
// bộ nhớ và báo cáo đọc dùng chung bộ phân tích này.
import type { z } from "zod";

/** Bỏ code fence và tìm đối tượng JSON ngoài cùng dù có văn bản ở trước/sau; thiếu thì null. */
export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}

/**
 * Bỏ code fence, tìm cặp ngoặc ngoài cùng, JSON.parse rồi kiểm tra Zod.
 * Bất kỳ bước nào lỗi thì trả null để bên gọi quyết định thử lại hoặc bỏ qua.
 */
export function parseJsonOutput<T extends z.ZodType>(text: string, schema: T): z.infer<T> | null {
  const json = extractJsonObject(text);
  if (json == null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
