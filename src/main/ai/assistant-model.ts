// src/main/ai/assistant-model.ts
import type { DB } from "@main/db/client";
import { loadProvider } from "@main/providers/repository";
import { resolveLanguageModel, type ChatModel } from "@main/ai/model-factory";
import { t } from "@main/i18n";
import { getPreference } from "@main/preferences/repository";
import type { AiProviderApiType } from "@shared/providers";
import type { ReasoningEffort } from "@shared/preferences";

export type ResolvedModel =
  | {
      ok: true;
      model: ChatModel;
      modelId: string;
      providerType?: AiProviderApiType;
      /** Mức reasoning của AI SDK v7; undefined dùng mặc định provider. */
      reasoningEffort?: ReasoningEffort;
    }
  | { ok: false; reason: string };

/**
 * Chuyển tùy chọn model chat thành model có thể gọi.
 * Thiếu cấu hình, provider bị xóa hoặc thiếu khóa đều trả lỗi có cấu trúc.
 */
export function resolveChatModel(db: DB): ResolvedModel {
  const pref = getPreference(db, "chatModel");
  if (!pref) {
    return { ok: false, reason: t("errors.chatModelNotConfigured", "Chưa cấu hình model trò chuyện") };
  }
  const provider = loadProvider(db, pref.providerId);
  if (!provider) {
    return {
      ok: false,
      reason: t("errors.configuredProviderNotFound", "Không tìm thấy $t(terms.provider) đã cấu hình"),
    };
  }
  if (!provider.apiKey) {
    return {
      ok: false,
      reason: t("errors.configuredProviderNoApiKey", "$t(terms.provider) chưa có API key"),
    };
  }
  try {
    const model = resolveLanguageModel({
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: pref.model,
    });
    return {
      ok: true,
      model,
      modelId: pref.model,
      providerType: provider.type,
      reasoningEffort: pref.reasoningEffort,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : t("errors.failedToBuildModel", "Không thể khởi tạo model"),
    };
  }
}

/**
 * Chọn model nền cho tóm tắt và đặt tên hội thoại.
 * Nếu thiếu cấu hình/provider/khóa, trả lỗi rõ ràng thay vì tự dùng model chat.
 */
export function resolveSummaryModel(db: DB): ResolvedModel {
  const pref = getPreference(db, "summaryModel");
  if (!pref) {
    return { ok: false, reason: t("errors.summaryModelNotConfigured", "Chưa cấu hình model tóm tắt") };
  }
  const provider = loadProvider(db, pref.providerId);
  if (!provider) {
    return {
      ok: false,
      reason: t("errors.configuredProviderNotFound", "Không tìm thấy $t(terms.provider) đã cấu hình"),
    };
  }
  if (!provider.apiKey) {
    return {
      ok: false,
      reason: t("errors.configuredProviderNoApiKey", "$t(terms.provider) chưa có API key"),
    };
  }
  try {
    const model = resolveLanguageModel({
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: pref.model,
    });
    return {
      ok: true,
      model,
      modelId: pref.model,
      providerType: provider.type,
      reasoningEffort: pref.reasoningEffort,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : t("errors.failedToBuildModel", "Không thể khởi tạo model"),
    };
  }
}
