import { splitForUtterance } from "./split-for-utterance";

export type TtsState = "idle" | "playing" | "paused";

/** Giao diện tối thiểu của SpeechSynthesisUtterance để có thể mock. */
export interface UtteranceLike {
  text: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  onend: (() => void) | null;
  onerror: ((err?: unknown) => void) | null;
}

/** Giao diện tối thiểu của speechSynthesis để mock; bản thật ở browserSpeechPort trong voices.ts. */
export interface SpeechPort {
  createUtterance: (text: string) => UtteranceLike;
  speak: (u: UtteranceLike) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
}

export interface TtsEngineEvents {
  /** Bắt đầu đọc một đoạn, dùng để tô sáng và cuộn. */
  onParagraphChange: (index: number) => void;
  onStateChange: (state: TtsState) => void;
  /** Đọc hết hàng đợi; lớp tích hợp quyết định chuyển chương vì engine không biết cấu trúc chương. */
  onQueueEnd: () => void;
  /** Một utterance lỗi đã được bỏ qua; lớp tích hợp ghi log. */
  onUtteranceError: (text: string, err: unknown) => void;
}

export interface PlayOptions {
  rate: number;
  /** Chọn giọng cho từng utterance; lớp tích hợp cung cấp cách nhận diện và chọn, engine chỉ quản lý hàng đợi. */
  pickVoiceFor: (text: string) => SpeechSynthesisVoice | null;
}

/**
 * State machine hàng đợi đoạn: idle → playing ⇄ paused → idle.
 * Bộ đếm generation bỏ qua onend/onerror tới muộn sau cancel; một số nền tảng vẫn gọi onend
 * cho utterance đang chờ, nếu không chặn sẽ tự tiến sai.
 */
export function createTtsEngine(port: SpeechPort, events: TtsEngineEvents) {
  let state: TtsState = "idle";
  let gen = 0;
  let texts: string[] = [];
  let current = 0;
  let opts: PlayOptions = { rate: 1, pickVoiceFor: () => null };
  let rateDirty = false;

  const setState = (s: TtsState) => {
    if (s === state) return;
    state = s;
    events.onStateChange(s);
  };

  /** Trên một số nền tảng cancel ngay sau pause không sạch; luôn resume trước. */
  const hardCancel = () => {
    port.resume();
    port.cancel();
  };

  const speakChunks = (
    chunks: string[],
    ci: number,
    myGen: number,
    voice: SpeechSynthesisVoice | null,
  ) => {
    if (myGen !== gen) return;
    if (ci >= chunks.length) {
      playParagraph(current + 1, myGen);
      return;
    }
    const text = chunks[ci]!;
    const u = port.createUtterance(text);
    u.voice = voice;
    u.rate = opts.rate;
    u.onend = () => speakChunks(chunks, ci + 1, myGen, voice);
    u.onerror = (err) => {
      if (myGen !== gen) return;
      events.onUtteranceError(text, err);
      speakChunks(chunks, ci + 1, myGen, voice);
    };
    port.speak(u);
  };

  const playParagraph = (i: number, myGen: number) => {
    if (myGen !== gen) return;
    if (i >= texts.length) {
      // Gọi onQueueEnd trước khi chuyển sang idle để lớp tích hợp kịp chuyển chương và phát tiếp.
      // Nếu đảo thứ tự, UI sẽ thấy idle thoáng qua và thanh điều khiển nhấp nháy.
      events.onQueueEnd();
      if (myGen === gen) setState("idle"); // Chỉ về idle nếu callback chưa bắt đầu lượt đọc mới.
      return;
    }
    current = i;
    events.onParagraphChange(i);
    // Mọi chunk của cùng một đoạn dùng chung giọng để tránh đổi giọng do nhận diện ngôn ngữ khác nhau.
    const voice = opts.pickVoiceFor(texts[i]!);
    speakChunks(splitForUtterance(texts[i]!), 0, myGen, voice);
  };

  return {
    play(newTexts: string[], startIndex: number, o: PlayOptions) {
      gen++;
      hardCancel();
      texts = newTexts;
      opts = o;
      rateDirty = false;
      setState("playing");
      playParagraph(startIndex, gen);
    },
    pause() {
      if (state !== "playing") return;
      port.pause();
      setState("paused");
    },
    resume() {
      if (state !== "paused") return;
      if (rateDirty) {
        // Đổi tốc độ khi tạm dừng không tự phát; tốc độ mới áp dụng từ đầu đoạn khi tiếp tục.
        rateDirty = false;
        gen++;
        hardCancel();
        setState("playing");
        playParagraph(current, gen);
      } else {
        port.resume();
        setState("playing");
      }
    },
    stop() {
      if (state === "idle") return;
      gen++;
      hardCancel();
      rateDirty = false;
      setState("idle");
    },
    setRate(rate: number) {
      opts = { ...opts, rate };
      if (state === "idle") return;
      if (state === "paused") {
        // Đổi tốc độ khi tạm dừng không tự phát; tốc độ mới áp dụng từ đầu đoạn khi tiếp tục.
        rateDirty = true;
        return;
      }
      // Khi đang phát, đọc lại từ đầu đoạn hiện tại với tốc độ mới.
      gen++;
      hardCancel();
      setState("playing");
      playParagraph(current, gen);
    },
    state: () => state,
  };
}

export type TtsEngine = ReturnType<typeof createTtsEngine>;
