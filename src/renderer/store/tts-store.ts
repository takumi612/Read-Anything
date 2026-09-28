import { create } from "zustand";
import type { TtsState } from "@renderer/reader/tts/tts-engine";

interface TtsUiState {
  /** Trạng thái phiên TTS quyết định thanh điều khiển và nút phát/tạm dừng; tts-controller ghi một chiều. */
  status: TtsState;
}

/** State TTS khi chạy, không lưu bền; tùy chọn nằm ở prefs-store.ttsPrefs. */
export const useTtsStore = create<TtsUiState>()(() => ({ status: "idle" }));
