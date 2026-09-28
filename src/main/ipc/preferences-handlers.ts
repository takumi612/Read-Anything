import { ipcMain } from "electron";
import { C } from "@shared/ipc";
import { getDb } from "@main/db/instance";
import { getAllPreferences, setPreference } from "@main/preferences/repository";
import { bind, register, type Binding } from "@main/ipc/registry";
import { setMainLanguage } from "@main/i18n";
import { invalidateAllAgentContexts } from "@main/ai/agent-context";

export const preferencesBindings: Binding[] = [
  // Lưu thay đổi lúc chạy qua IPC bất đồng bộ.
  bind(C.preferencesSet, (input) => {
    // Thu hẹp kiểu theo key để giữ đúng cặp key/value sau khi Zod đã kiểm tra.
    switch (input.key) {
      case "readerPrefs":
        return setPreference(getDb(), input.key, input.value);
      case "lastHighlightStyle":
        return setPreference(getDb(), input.key, input.value);
      case "annotationPalette":
        return setPreference(getDb(), input.key, input.value);
      case "annotationColors":
        return setPreference(getDb(), input.key, input.value);
      case "autoSummarize":
        return setPreference(getDb(), input.key, input.value);
      case "onboardingDismissed":
        return setPreference(getDb(), input.key, input.value);
      case "colorMode":
        return setPreference(getDb(), input.key, input.value);
      case "epubColorMode":
        return setPreference(getDb(), input.key, input.value);
      case "pdfColorMode":
        return setPreference(getDb(), input.key, input.value);
      case "pdfSurroundingBackground":
        return setPreference(getDb(), input.key, input.value);
      case "appBackgroundMode":
        return setPreference(getDb(), input.key, input.value);
      case "appBackgroundColor":
        return setPreference(getDb(), input.key, input.value);
      case "appBackgroundBlobId":
        return setPreference(getDb(), input.key, input.value);
      case "language":
        setMainLanguage(input.value);
        return setPreference(getDb(), input.key, input.value);
      case "readerLayout":
        return setPreference(getDb(), input.key, input.value);
      case "summaryModel":
        return setPreference(getDb(), input.key, input.value);
      case "pdfZoom":
        return setPreference(getDb(), input.key, input.value);
      case "pdfBrightness":
        return setPreference(getDb(), input.key, input.value);
      case "pdfSurroundingBrightness":
        return setPreference(getDb(), input.key, input.value);
      case "restorePdfTabs":
        return setPreference(getDb(), input.key, input.value);
      case "stepLimit":
        return setPreference(getDb(), input.key, input.value);
      case "backgroundConcurrency":
        return setPreference(getDb(), input.key, input.value);
      case "chatModel":
        return setPreference(getDb(), input.key, input.value);
      case "aiDataConsent":
        return setPreference(getDb(), input.key, input.value);
      case "memoryEnabled": {
        invalidateAllAgentContexts();
        return setPreference(getDb(), input.key, input.value);
      }
      case "memoryAutoConsolidate":
        return setPreference(getDb(), input.key, input.value);
      case "soul": {
        invalidateAllAgentContexts();
        return setPreference(getDb(), input.key, input.value);
      }
      case "instructions": {
        invalidateAllAgentContexts();
        return setPreference(getDb(), input.key, input.value);
      }
      case "ttsPrefs":
        return setPreference(getDb(), input.key, input.value);
      case "showAgentAvatar":
        return setPreference(getDb(), input.key, input.value);
      case "avatarBlobId":
        return setPreference(getDb(), input.key, input.value);
      case "webSearch":
        return setPreference(getDb(), input.key, input.value);
      case "webSearchEnabled":
        return setPreference(getDb(), input.key, input.value);
      default: {
        // Buộc thêm nhánh khi có preference key mới; thiếu sẽ báo lỗi biên dịch.
        // Trước đây thiếu nhánh có thể làm IPC báo thành công nhưng không lưu gì.
        const _exhaustive: never = input;
        return _exhaustive;
      }
    }
  }),
];

export function registerPreferenceHandlers(): void {
  register(preferencesBindings);

  // Preload đọc snapshot đồng bộ trước khung hình đầu để khởi tạo theme và store.
  // Nếu DB chưa sẵn sàng, trả {} thay vì làm hỏng lần vẽ đầu.
  ipcMain.on(C.preferencesGetAllSync.channel, (e) => {
    try {
      e.returnValue = getAllPreferences(getDb());
    } catch {
      e.returnValue = {};
    }
  });
}
