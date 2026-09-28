import { and, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { providers } from "@main/db/schema";
import type { AiProviderApiType } from "@shared/providers";
import { createLogger } from "@main/logger";

const log = createLogger("providers");

interface DefaultProvider {
  type: AiProviderApiType;
  /** Các định dạng API hỗ trợ; nhiều lựa chọn mới cho phép đổi type. */
  compatibleApis: AiProviderApiType[];
  label: string;
  models: string[];
}

/** Danh sách provider tích hợp. models là gợi ý ban đầu; baseUrl null dùng URL mặc định
 * hoặc được suy ra theo type cho DeepSeek. Không có API key mặc định.
 * label là danh tính cố định; thêm phần tử sẽ được ensureBuiltinProviders tạo khi khởi động. */
export const DEFAULT_PROVIDERS: DefaultProvider[] = [
  {
    type: "openai-responses",
    compatibleApis: ["openai-responses"],
    label: "OpenAI",
    models: ["gpt-5.5", "gpt-5.4-mini", "gpt-5.4-nano"],
  },
  {
    type: "anthropic",
    compatibleApis: ["anthropic"],
    label: "Anthropic",
    models: ["claude-sonnet-4-6", "claude-haiku-4-5"],
  },
  {
    type: "google-generate-content",
    compatibleApis: ["google-generate-content"],
    label: "Gemini",
    models: ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"],
  },
  {
    // DeepSeek hỗ trợ ba giao thức trên cùng host nhưng endpoint khác nhau.
    // Mặc định dùng chat-completions; URL được suy ra theo type thay vì lưu trong DB.
    type: "openai-chat-completions",
    compatibleApis: ["openai-chat-completions", "openai-responses", "anthropic"],
    label: "DeepSeek",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
];

/**
 * Khi khởi động, thêm provider tích hợp còn thiếu theo label và isBuiltin.
 * Provider đã có chỉ được bổ sung compatibleApis mới; giữ nguyên type, key và models của người dùng.
 * Provider tự tạo trùng tên không được coi là provider tích hợp.
 */
export function ensureBuiltinProviders(db: DB): void {
  const inserted: string[] = [];
  const upgraded: string[] = [];
  for (const p of DEFAULT_PROVIDERS) {
    const existing = db
      .select({ id: providers.id, compatibleApis: providers.compatibleApis })
      .from(providers)
      .where(and(eq(providers.isBuiltin, true), eq(providers.label, p.label)))
      .limit(1)
      .all();
    if (existing.length > 0) {
      const row = existing[0];
      const current = row.compatibleApis ?? [];
      if (p.compatibleApis.some((api) => !current.includes(api))) {
        db.update(providers)
          .set({ compatibleApis: p.compatibleApis })
          .where(eq(providers.id, row.id))
          .run();
        upgraded.push(p.label);
      }
      continue;
    }
    db.insert(providers)
      .values({
        type: p.type,
        compatibleApis: p.compatibleApis,
        label: p.label,
        models: p.models,
        isBuiltin: true,
      })
      .run();
    inserted.push(p.label);
  }
  if (inserted.length > 0) {
    log.info(`ensured builtin providers: ${inserted.join(", ")}`);
  }
  if (upgraded.length > 0) {
    log.info(`upgraded builtin provider compatibleApis: ${upgraded.join(", ")}`);
  }
}
