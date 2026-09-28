import { resolveProviderBaseUrl } from "@shared/providers";
import type { ProviderRow } from "@main/providers/repository";
import { decryptApiKey } from "@main/secrets/api-key-storage";

declare const PROVIDER_BRAND: unique symbol;

/**
 * Provider đã chuẩn hóa để tạo model; baseUrl hiệu lực được suy ra theo type,
 * gồm cả provider tích hợp như DeepSeek có URL null trong DB.
 *
 * Kiểu có dấu riêng chỉ được tạo bởi createProvider; hàm tạo model nhận kiểu này
 * để không vô tình dùng dòng DB với baseUrl còn null.
 */
export type Provider = ProviderRow & { readonly [PROVIDER_BRAND]: true };

/** Chuyển dòng DB thành Provider đã chuẩn hóa; đây là điểm tạo duy nhất. */
export function createProvider(row: ProviderRow): Provider {
  return {
    ...row,
    apiKey: decryptApiKey(row.apiKey),
    baseUrl: resolveProviderBaseUrl(row, row.type),
  } as Provider;
}
