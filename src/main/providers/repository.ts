import { asc, eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { providers } from "@main/db/schema";
import type { ProviderTester } from "@main/secrets/tester";
import { maskKey } from "@main/providers/mask";
import { createProvider, type Provider } from "@main/providers/provider-factory";
import { t } from "@main/i18n";
import { encryptApiKey, isEncryptedApiKey, decryptApiKey } from "@main/secrets/api-key-storage";
import type { ProviderDto, TestResult, UpsertProviderInput } from "@shared/providers";

export type ProviderRow = typeof providers.$inferSelect;

/**
 * Chuyển provider thành DTO cho renderer; khóa gốc chỉ ở main, DTO chỉ có bản đã che.
 * baseUrl đã được factory suy ra theo type. Bỏ qua apiKey để giữ khóa cũ, truyền để thay khóa.
 * Với label/baseUrl, bỏ qua là giữ nguyên; null tường minh là xóa giá trị.
 */
function toDto(provider: Provider): ProviderDto {
  return {
    id: provider.id,
    type: provider.type,
    compatibleApis: provider.compatibleApis ?? [provider.type],
    label: provider.label ?? null,
    baseUrl: provider.baseUrl, // URL đã được factory suy ra, kể cả DeepSeek tích hợp.
    keyMask: provider.apiKey == null ? null : maskKey(provider.apiKey),
    models: provider.models ?? [],
    isBuiltin: provider.isBuiltin,
    createdAt: provider.createdAt,
  };
}

export function getProviderRow(db: DB, id: string): ProviderRow | undefined {
  return db.select().from(providers).where(eq(providers.id, id)).get();
}

/** Lấy provider qua factory để có baseUrl hiệu lực theo type. */
export function loadProvider(db: DB, id: string): Provider | undefined {
  const row = getProviderRow(db, id);
  return row ? createProvider(row) : undefined;
}

export function listProviders(db: DB): ProviderDto[] {
  return db
    .select()
    .from(providers)
    .orderBy(asc(providers.createdAt))
    .all()
    .map((r) => toDto(createProvider(r)));
}

/**
 * Provider tự thêm phải có baseUrl; chỉ provider tích hợp mới dùng endpoint mặc định
 * hoặc URL suy ra từ type. Vì phụ thuộc isBuiltin, quy tắc này được kiểm tra trong repository.
 */
function assertUsableBaseUrl(p: { isBuiltin: boolean; baseUrl: string | null }): void {
  if (!p.isBuiltin && p.baseUrl == null) {
    throw new Error(
      t("errors.baseUrlRequiredCustom", "$t(terms.provider) tùy chỉnh phải có baseUrl"),
    );
  }
}

export function upsertProvider(db: DB, input: UpsertProviderInput): ProviderDto {
  if (input.id) {
    const existing = getProviderRow(db, input.id);
    if (!existing)
      throw new Error(
        t("errors.providerNotFound", "Không tìm thấy $t(terms.provider) {{id}}", { id: input.id }),
      );
    // Provider tích hợp không cho sửa tên/URL; type phải thuộc compatibleApis.
    if (existing.isBuiltin) {
      const compat = existing.compatibleApis ?? [existing.type];
      if (input.type !== existing.type && !compat.includes(input.type)) {
        throw new Error(
          t(
            "errors.builtinTypeOutsideCompat",
            "Chỉ có thể đổi loại $t(terms.provider) tích hợp sẵn trong API tương thích",
          ),
        );
      }
      if (input.label != null && input.label !== existing.label) {
        throw new Error(
          t("errors.builtinLabelLocked", "Không thể đổi tên $t(terms.provider) tích hợp sẵn"),
        );
      }
      if (input.baseUrl != null && input.baseUrl !== existing.baseUrl) {
        throw new Error(
          t(
            "errors.builtinBaseUrlLocked",
            "Không thể đổi baseUrl của $t(terms.provider) tích hợp sẵn",
          ),
        );
      }
    }
    const lockedMeta = existing.isBuiltin; // Khóa tên và URL của provider tích hợp.
    // Kiểm tra trạng thái sau cập nhật; provider tự thêm không được có baseUrl rỗng.
    const finalBaseUrl = lockedMeta
      ? existing.baseUrl
      : input.baseUrl !== undefined
        ? input.baseUrl
        : existing.baseUrl;
    assertUsableBaseUrl({ isBuiltin: existing.isBuiltin, baseUrl: finalBaseUrl });
    const row = db
      .update(providers)
      .set({
        type: input.type, // type đã được kiểm tra theo compatibleApis khi cần.
        ...(!lockedMeta && input.label !== undefined ? { label: input.label } : {}),
        ...(!lockedMeta && input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.apiKey !== undefined ? { apiKey: encryptApiKey(input.apiKey) } : {}),
        ...(input.models !== undefined ? { models: input.models } : {}),
        // Provider tự thêm có compatibleApis theo type hiện tại; provider tích hợp giữ cấu hình gốc.
        ...(!existing.isBuiltin ? { compatibleApis: [input.type] } : {}),
      })
      .where(eq(providers.id, input.id))
      .returning()
      .get();
    if (!row)
      throw new Error(
        t("errors.providerNotFound", "Không tìm thấy $t(terms.provider) {{id}}", { id: input.id }),
      );
    return toDto(createProvider(row));
  }

  // Provider tự thêm phải truyền baseUrl vì không có endpoint mặc định.
  assertUsableBaseUrl({ isBuiltin: false, baseUrl: input.baseUrl ?? null });
  const inserted = db
    .insert(providers)
    .values({
      type: input.type,
      compatibleApis: [input.type], // Provider tự thêm chỉ có type hiện tại.
      label: input.label ?? null,
      baseUrl: input.baseUrl ?? null,
      apiKey: input.apiKey == null ? null : encryptApiKey(input.apiKey),
      models: input.models ?? [],
    })
    .returning()
    .get();
  return toDto(createProvider(inserted));
}

export function removeProvider(db: DB, id: string): void {
  const row = getProviderRow(db, id);
  if (!row)
    throw new Error(
      t("errors.providerNotFound", "Không tìm thấy $t(terms.provider) {{id}}", { id }),
    );
  if (row.isBuiltin)
    throw new Error(
      t("errors.builtinUndeletable", "Không thể xóa $t(terms.provider) tích hợp sẵn"),
    );
  // chatModel và summaryModel lưu providerId trong JSON, không có khóa ngoại.
  // Nếu provider bị xóa, bước resolve sẽ báo không tìm thấy; không cần sửa tùy chọn ở đây.
  db.delete(providers).where(eq(providers.id, id)).run();
}

export function revealProviderKey(db: DB, id: string): string {
  const row = getProviderRow(db, id);
  if (!row)
    throw new Error(
      t("errors.providerNotFound", "Không tìm thấy $t(terms.provider) {{id}}", { id }),
    );
  if (row.apiKey == null)
    throw new Error(
      t("errors.providerHasNoApiKey", "$t(terms.provider) {{id}} chưa có API key", { id }),
    );
  return decryptApiKey(row.apiKey)!;
}

/** Upgrade keys written by older versions from plaintext to OS-protected values. */
export function migrateProviderApiKeys(db: DB): void {
  const rows = db.select().from(providers).all();
  for (const row of rows) {
    if (row.apiKey == null || isEncryptedApiKey(row.apiKey)) continue;
    try {
      db.update(providers)
        .set({ apiKey: encryptApiKey(row.apiKey) })
        .where(eq(providers.id, row.id))
        .run();
    } catch {
      // Do not prevent the app from opening on systems without an OS key store.
      // New keys are refused by encryptApiKey until secure storage is available.
      return;
    }
  }
}

export async function testProvider(
  db: DB,
  tester: ProviderTester,
  id: string,
  model: string,
): Promise<TestResult> {
  const provider = loadProvider(db, id);
  if (!provider)
    throw new Error(
      t("errors.providerNotFound", "Không tìm thấy $t(terms.provider) {{id}}", { id }),
    );
  if (provider.apiKey == null) {
    return {
      ok: false,
      message: t("errors.noApiKeySet", "$t(terms.provider) này chưa có API key"),
    };
  }
  // Factory đã suy ra baseUrl theo type; trường hợp DeepSeek được xử lý tập trung.
  return tester.test({
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model,
  });
}
