import type { ChatModel } from "@shared/preferences";
import type { ProviderDto } from "@shared/providers";

/**
 * Bước đầu hoàn tất khi đã chọn provider/model chat và provider đó có khóa API.
 * Trả false nếu danh sách provider chưa tải hoặc không tìm thấy provider; bên gọi cần chờ query sẵn sàng.
 */
export function isModelConnected(
  chatModel: ChatModel | null,
  providers: ProviderDto[] | undefined,
): boolean {
  if (!chatModel?.providerId || !chatModel.model) return false;
  const provider = providers?.find((p) => p.id === chatModel.providerId);
  return provider != null && provider.keyMask != null;
}

/** AI onboarding is complete when a configured model is available for reader Q&A. */
export function isOnboardingComplete(modelConnected: boolean): boolean {
  return modelConnected;
}
