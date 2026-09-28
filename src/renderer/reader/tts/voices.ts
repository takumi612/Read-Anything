import { createLogger } from "@renderer/logger";
import type { SpeechPort, UtteranceLike } from "./tts-engine";
import type { TtsPlatform } from "./pick-voice";

const log = createLogger("tts");

/** Bản chuyển tiếp tới speechSynthesis thật theo giao diện SpeechPort của tts-engine. */
export function browserSpeechPort(): SpeechPort {
  const synth = window.speechSynthesis;
  return {
    createUtterance: (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
    speak: (u) => synth.speak(u as SpeechSynthesisUtterance),
    cancel: () => synth.cancel(),
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  };
}

// Cần khởi động lại ứng dụng để cache nhận giọng hệ thống mới cài.
let voicesCache: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/**
 * getVoices() có thể trả danh sách rỗng ở lần đầu, nên chờ voiceschanged.
 * Khi hết giờ thì trả danh sách hiện tại, dù vẫn rỗng; pickVoice sẽ trả null để engine tự chọn.
 */
export function getVoicesReady(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (voicesCache?.length) return Promise.resolve(voicesCache);
  if (voicesPromise) return voicesPromise;
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) {
    voicesCache = now;
    return Promise.resolve(now);
  }
  voicesPromise = new Promise((resolve) => {
    const finish = (list: SpeechSynthesisVoice[]) => {
      voicesCache = list;
      voicesPromise = null;
      resolve(list);
    };
    const timer = setTimeout(() => {
      log.warn("voiceschanged timed out, proceeding with current voice list");
      finish(synth.getVoices());
    }, timeoutMs);
    synth.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timer);
        finish(synth.getVoices());
      },
      { once: true },
    );
  });
  return voicesPromise;
}

export function currentPlatform(): TtsPlatform {
  const p = navigator.platform.toLowerCase();
  if (p.includes("mac")) return "macos";
  if (p.includes("win")) return "windows";
  return "linux";
}
