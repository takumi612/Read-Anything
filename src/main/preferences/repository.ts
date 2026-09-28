import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { preferences } from "@main/db/schema";
import { decryptApiKey, encryptApiKey, isEncryptedApiKey } from "@main/secrets/api-key-storage";
import { redactWebSearchKeys, webSearchConfig, type WebSearchConfig } from "@shared/web-search";
import {
  PREFERENCE_SCHEMAS,
  type PreferenceKey,
  type PreferenceValue,
  type PreferencesSnapshot,
} from "@shared/preferences";

/** Đọc tùy chọn; nếu thiếu hoặc JSON cũ/sai schema thì trả null để dùng mặc định. */
export function getPreference<K extends PreferenceKey>(db: DB, key: K): PreferenceValue<K> | null {
  const row = db.select().from(preferences).where(eq(preferences.key, key)).get();
  if (!row) return null;
  // Keep the previous Chinese UI preference readable after the locale switch.
  const value = key === "language" && row.value === "zh-CN" ? "vi" : row.value;
  const parsed = PREFERENCE_SCHEMAS[key].safeParse(value);
  if (!parsed.success) return null;
  if (key === "webSearch") {
    const config = parsed.data as WebSearchConfig;
    return {
      backends: config.backends.map((backend) => ({
        ...backend,
        apiKey: backend.apiKey ? decryptApiKey(backend.apiKey)! : undefined,
      })),
    } as PreferenceValue<K>;
  }
  return parsed.data as PreferenceValue<K>;
}

function sameSearchBackend(a: WebSearchConfig["backends"][number], b: WebSearchConfig["backends"][number]): boolean {
  return a.kind === b.kind && (a.kind !== "mcp" || (b.kind === "mcp" && a.url === b.url && a.toolName === b.toolName));
}

function protectWebSearchKeys(config: WebSearchConfig, existing: WebSearchConfig | null): WebSearchConfig {
  return {
    backends: config.backends.map((backend, index) => {
      const { apiKey, hasApiKey: _hasApiKey, ...publicFields } = backend;
      const previous = existing?.backends[index];
      const retained =
        apiKey === undefined && backend.hasApiKey && previous && sameSearchBackend(backend, previous)
          ? previous.apiKey
          : undefined;
      const secret = apiKey?.trim()
        ? encryptApiKey(apiKey.trim())
        : retained
          ? encryptApiKey(retained)
          : undefined;
      return { ...publicFields, ...(secret ? { apiKey: secret } : {}) };
    }),
  };
}

/** Ghi tùy chọn sau khi kiểm tra schema theo key; null sẽ xóa dòng. */
export function setPreference<K extends PreferenceKey>(
  db: DB,
  key: K,
  value: PreferenceValue<K>,
): void {
  const validated = PREFERENCE_SCHEMAS[key].parse(value);
  if (validated === null) {
    // Đặt tùy chọn nullable về null nghĩa là xóa dòng; đọc dòng thiếu cũng trả null.
    db.delete(preferences).where(eq(preferences.key, key)).run();
    return;
  }
  const existingWebSearch =
    key === "webSearch"
      ? webSearchConfig.safeParse(
          db.select({ value: preferences.value }).from(preferences).where(eq(preferences.key, key)).get()?.value,
        )
      : null;
  const storedValue =
    key === "webSearch"
      ? protectWebSearchKeys(
          validated as WebSearchConfig,
          existingWebSearch?.success ? existingWebSearch.data : null,
        )
      : validated;
  const now = Date.now();
  db.insert(preferences)
    .values({ key, value: storedValue, updatedAt: now })
    .onConflictDoUpdate({ target: preferences.key, set: { value: storedValue, updatedAt: now } })
    .run();
}

/** Upgrade optional web-search credentials saved in plaintext by older versions. */
export function migrateWebSearchApiKeys(db: DB): void {
  const row = db.select().from(preferences).where(eq(preferences.key, "webSearch")).get();
  const parsed = webSearchConfig.safeParse(row?.value);
  if (!row || !parsed.success) return;
  if (!parsed.data.backends.some((backend) => backend.apiKey && !isEncryptedApiKey(backend.apiKey))) return;
  try {
    const value = protectWebSearchKeys(parsed.data, null);
    db.update(preferences)
      .set({ value, updatedAt: Date.now() })
      .where(eq(preferences.key, "webSearch"))
      .run();
  } catch {
    // Existing data remains readable; saving a new key still requires OS encryption.
  }
}

/** Snapshot tùy chọn lúc renderer khởi động; bỏ key lạ hoặc dữ liệu hỏng. */
export function getAllPreferences(db: DB): PreferencesSnapshot {
  const out: PreferencesSnapshot = {};
  for (const row of db.select().from(preferences).all()) {
    const key = row.key as PreferenceKey;
    const schema = PREFERENCE_SCHEMAS[key];
    if (!schema) continue; // Key cũ đã bị xóa khỏi registry.
    const value = key === "language" && row.value === "zh-CN" ? "vi" : row.value;
    const parsed = schema.safeParse(value);
    if (parsed.success) {
      (out as Record<PreferenceKey, unknown>)[key] =
        key === "webSearch" ? redactWebSearchKeys(parsed.data as WebSearchConfig) : parsed.data;
    }
  }
  return out;
}
