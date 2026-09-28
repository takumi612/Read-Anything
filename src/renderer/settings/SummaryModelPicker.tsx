import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { ModelPickerSection } from "./ModelPickerSection";

/**
 * Khối chọn mô hình tóm tắt chương, cả sách và đặt tên hội thoại.
 * Tùy chọn là cặp provider/model; khi đổi provider mà chưa chọn model thì giữ bản nháp cục bộ.
 * Chỉ lưu cả cặp qua setSummaryModel sau khi chọn model.
 */
export function SummaryModelPicker() {
  const { t } = useTranslation();
  const stored = usePrefsStore((s) => s.summaryModel);
  const setSummaryModel = usePrefsStore((s) => s.setSummaryModel);
  const [draftProvider, setDraftProvider] = useState<string | null>(null);

  const providerId = draftProvider ?? stored?.providerId ?? "";
  // Quay lại provider đã lưu thì khôi phục model cũ; provider khác hiện placeholder rỗng.
  const model =
    draftProvider != null && draftProvider !== stored?.providerId ? "" : (stored?.model ?? "");
  const effort = stored?.reasoningEffort;

  return (
    <ModelPickerSection
      title={t("settings.summaryModel", "Model tóm tắt")}
      description={t("settings.summaryModel.desc", "Dùng để tóm tắt chương, sách và tự đặt tên cuộc trò chuyện")}
      providerId={providerId}
      model={model}
      onProviderChange={setDraftProvider}
      onModelChange={(m) => {
        if (!providerId) return;
        // Đổi model vẫn giữ mức hiện tại vì mức này độc lập với provider.
        setSummaryModel({ providerId, model: m, reasoningEffort: effort });
        setDraftProvider(null);
      }}
      reasoningEffort={effort}
      // Tắt khi chưa lưu model hoặc đang chuyển provider mà chưa chọn model.
      reasoningEffortDisabled={stored == null || draftProvider != null}
      onReasoningEffortChange={(e) => {
        if (!stored) return;
        setSummaryModel({ providerId: stored.providerId, model: stored.model, reasoningEffort: e });
      }}
    />
  );
}
