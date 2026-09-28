import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { ModelPickerSection } from "./ModelPickerSection";

/**
 * Khối chọn mô hình chat thay cấu hình bảng assistants.
 * Tùy chọn là cặp provider/model; khi đổi provider mà chưa chọn model thì giữ bản nháp cục bộ.
 * Chỉ lưu cả cặp qua setChatModel sau khi chọn model, giống SummaryModelPicker.
 */
export function AssistantModelPicker() {
  const { t } = useTranslation();
  const stored = usePrefsStore((s) => s.chatModel);
  const setChatModel = usePrefsStore((s) => s.setChatModel);
  const [draftProvider, setDraftProvider] = useState<string | null>(null);

  const providerId = draftProvider ?? stored?.providerId ?? "";
  // Quay lại provider đã lưu thì khôi phục model cũ; provider khác hiện placeholder rỗng.
  const model =
    draftProvider != null && draftProvider !== stored?.providerId ? "" : (stored?.model ?? "");
  const effort = stored?.reasoningEffort;

  return (
    <ModelPickerSection
      title={t("settings.assistantModel", "Model trò chuyện")}
      providerId={providerId}
      model={model}
      onProviderChange={setDraftProvider}
      onModelChange={(m) => {
        if (!providerId) return;
        // Đổi model vẫn giữ mức hiện tại vì mức này độc lập với provider.
        setChatModel({ providerId, model: m, reasoningEffort: effort });
        setDraftProvider(null);
      }}
      reasoningEffort={effort}
      // Tắt khi chưa lưu model hoặc đang chuyển provider mà chưa chọn model.
      reasoningEffortDisabled={stored == null || draftProvider != null}
      onReasoningEffortChange={(e) => {
        if (!stored) return;
        setChatModel({ providerId: stored.providerId, model: stored.model, reasoningEffort: e });
      }}
    />
  );
}
