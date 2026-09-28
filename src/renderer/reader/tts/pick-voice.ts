import type { TtsLang } from "./detect-lang";

export type TtsPlatform = "macos" | "windows" | "linux";

/** Giọng hiệu ứng của macOS; ghép đơn giản theo lang có thể chọn nhầm các giọng này. */
export const NOVELTY_BLOCKLIST: readonly string[] = [
  "Albert",
  "Bad News",
  "Bahh",
  "Bells",
  "Boing",
  "Bubbles",
  "Cellos",
  "Good News",
  "Jester",
  "Organ",
  "Superstar",
  "Trinoids",
  "Whisper",
  "Wobble",
  "Zarvox",
];

/**
 * Danh sách giọng đề xuất theo nền tảng, thử lần lượt theo thứ tự.
 * macOS dùng các giọng đã kiểm tra; Windows/Linux dùng cách chọn chung theo ngôn ngữ,
 * ưu tiên localService và giọng mặc định cho tới khi có danh sách được kiểm tra riêng.
 */
export const RECOMMENDED_VOICES: Record<TtsPlatform, Partial<Record<TtsLang, string[]>>> = {
  macos: {
    en: ["Samantha", "Alex", "Karen", "Daniel"],
    // macOS bản địa hóa tên giọng theo ngôn ngữ hệ thống; liệt kê cả tên gốc lẫn tên Latin.
    zh: ["Tingting", "婷婷", "Meijia", "美佳", "Sinji", "善怡"],
    ja: ["Kyoko", "京子"],
  },
  windows: {},
  linux: {},
};

const LANG_PREFIX: Record<TtsLang, string> = { zh: "zh", ja: "ja", en: "en", vi: "vi" };

export interface VoicePrefsLike {
  voiceByLang: Record<string, string>;
}

export interface PickVoiceOptions {
  /** Excludes system-backed online voices for actions that must stay on-device. */
  localOnly?: boolean;
}

/**
 * Chọn giọng theo thứ tự: tùy chọn người dùng, danh sách đề xuất theo nền tảng,
 * cách chọn chung có lọc giọng hiệu ứng và ưu tiên localService/giọng mặc định,
 * cuối cùng trả null để engine tự chọn.
 */
export function pickVoice(
  lang: TtsLang,
  voices: SpeechSynthesisVoice[],
  prefs: VoicePrefsLike,
  platform: TtsPlatform,
  options: PickVoiceOptions = {},
): SpeechSynthesisVoice | null {
  const candidates = options.localOnly ? voices.filter((voice) => voice.localService) : voices;
  const matches = candidates.filter((v) => v.lang.toLowerCase().startsWith(LANG_PREFIX[lang]));
  const wanted = prefs.voiceByLang[lang];
  if (wanted) {
    const hit =
      matches.find((v) => v.name === wanted) ??
      (options.localOnly ? undefined : candidates.find((v) => v.name === wanted));
    if (hit) return hit;
  }
  for (const name of RECOMMENDED_VOICES[platform][lang] ?? []) {
    const hit = matches.find((v) => v.name === name);
    if (hit) return hit;
  }
  const usable = matches.filter((v) => !NOVELTY_BLOCKLIST.includes(v.name));
  return (
    usable.find((v) => v.localService && v.default) ??
    usable.find((v) => v.localService) ??
    usable.find((v) => v.default) ??
    usable[0] ??
    null
  );
}
