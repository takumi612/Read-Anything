import { createLogger } from "@renderer/logger";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useTtsStore } from "@renderer/store/tts-store";
import { detectParagraphLang } from "./detect-lang";
import { pickVoice } from "./pick-voice";
import { segmentParagraphs, type TtsParagraph } from "./segment-paragraphs";
import { createTtsEngine, type TtsEngine } from "./tts-engine";
import { browserSpeechPort, currentPlatform, getVoicesReady } from "./voices";

const log = createLogger("tts");

/** Ngữ cảnh EpubReader gắn vào và tháo ra khi rời trình đọc. */
export interface ReaderTtsContext {
  sectionCount: number;
  getTopSectionIndex: () => number;
  scrollToSection: (index: number) => void;
  /** Khung cuộn thực do VirtualDocs cung cấp, tránh phụ thuộc selector class toàn cục. */
  getScroller: () => Element | null;
}

const SECTION_DOC_POLL_MS = 100;
const SECTION_DOC_TIMEOUT_MS = 5000;
/** Khoảng thời gian bỏ qua sự kiện scroll sau khi tự cuộn để phân biệt với người dùng cuộn. */
const AUTO_SCROLL_IGNORE_MS = 300;

function sectionDoc(index: number): Document | null {
  const frame = document.querySelector<HTMLIFrameElement>(`[data-section-index="${index}"] iframe`);
  const doc = frame?.contentDocument ?? null;
  return doc?.body && doc.body.childNodes.length > 0 ? doc : null;
}

function sectionFrame(index: number): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(`[data-section-index="${index}"] iframe`);
}

/** Đoạn đầu tiên nhìn thấy trong khung; nếu không có thì bắt đầu từ đoạn 0 của section. */
function firstVisibleParagraph(
  paras: TtsParagraph[],
  frame: HTMLIFrameElement,
  scroller: Element | null,
): number {
  if (!scroller) return 0;
  const frameTop = frame.getBoundingClientRect().top;
  const view = scroller.getBoundingClientRect();
  for (let i = 0; i < paras.length; i++) {
    const r = paras[i]!.element.getBoundingClientRect(); // Iframe không tự cuộn: tọa độ chính = frameTop + r.
    if (frameTop + r.bottom > view.top + 4 && frameTop + r.top < view.bottom) return i;
  }
  return 0;
}

class TtsController {
  private ctx: ReaderTtsContext | null = null;
  private engine: TtsEngine | null = null;
  private paragraphs: TtsParagraph[] = [];
  private sectionIndex = 0;
  private voices: SpeechSynthesisVoice[] = [];
  /** Đang tự chuyển chương: bỏ trạng thái idle thoáng qua và không coi đó là người dùng điều hướng. */
  private crossing = false;
  private followSuspended = false;
  private ignoreScrollUntil = 0;
  private readonly onScrollerScroll = () => {
    if (performance.now() > this.ignoreScrollUntil && this.status() !== "idle") {
      this.followSuspended = true;
    }
  };

  attach(ctx: ReaderTtsContext): void {
    this.ctx = ctx;
    // scroll không nổi bọt nhưng có thể bắt ở pha capture như trong EpubReader.
    // VirtualDocs chuyển con lăn trong iframe thành cuộn scroller nên listener trên document nhận được.
    document.addEventListener("scroll", this.onScrollerScroll, true);
  }

  detach(): void {
    this.stop();
    document.removeEventListener("scroll", this.onScrollerScroll, true);
    this.ctx = null;
  }

  status() {
    return useTtsStore.getState().status;
  }

  async playFromViewport(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    this.voices = await getVoicesReady();
    // Nếu đổi hoặc tháo sách trong lúc await, bỏ lần bắt đầu đọc này.
    if (this.ctx !== ctx) return;
    const index = ctx.getTopSectionIndex();
    const doc = sectionDoc(index);
    const frame = sectionFrame(index);
    if (!doc || !frame) {
      log.warn(`play aborted: section ${index} iframe not ready`);
      return;
    }
    const paras = segmentParagraphs(doc.body);
    if (paras.length === 0) {
      log.warn(`play aborted: section ${index} has no readable paragraphs`);
      return;
    }
    this.followSuspended = false;
    this.startSection(index, paras, firstVisibleParagraph(paras, frame, ctx.getScroller()));
  }

  pause(): void {
    this.engine?.pause();
  }

  resume(): void {
    this.followSuspended = false;
    this.engine?.resume();
  }

  stop(): void {
    this.crossing = false;
    this.engine?.stop();
    this.clearHighlight();
  }

  setRate(rate: number): void {
    this.engine?.setRate(rate);
  }

  /** Người dùng chuyển chương hoặc tới chú thích sẽ ngắt đọc; tự chuyển chương thì không. */
  notifyUserNavigation(): void {
    if (this.crossing || this.status() === "idle") return;
    this.stop();
  }

  private ensureEngine(): TtsEngine {
    if (this.engine) return this.engine;
    this.engine = createTtsEngine(browserSpeechPort(), {
      onParagraphChange: (i) => this.onParagraph(i),
      onStateChange: (s) => {
        if (this.crossing && s === "idle") return; // Không phát trạng thái idle thoáng qua khi chuyển chương.
        useTtsStore.setState({ status: s });
      },
      onQueueEnd: () => void this.advanceSection(),
      onUtteranceError: (text, err) => log.warn(`utterance failed: ${text.slice(0, 40)}`, err),
    });
    return this.engine;
  }

  private startSection(index: number, paras: TtsParagraph[], startPara: number): void {
    const prefs = usePrefsStore.getState().ttsPrefs;
    const platform = currentPlatform();
    this.sectionIndex = index;
    this.paragraphs = paras;
    this.ensureEngine().play(
      paras.map((p) => p.text),
      startPara,
      {
        rate: prefs.rate,
        pickVoiceFor: (text) => pickVoice(detectParagraphLang(text), this.voices, prefs, platform),
      },
    );
  }

  private async advanceSection(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    let next = this.sectionIndex + 1;
    this.crossing = true;
    this.clearHighlight(); // Xóa tô sáng còn lại trước khi sectionIndex trỏ sang chương mới.
    try {
      while (next < ctx.sectionCount) {
        this.ignoreScrollUntil = performance.now() + AUTO_SCROLL_IGNORE_MS + SECTION_DOC_TIMEOUT_MS;
        ctx.scrollToSection(next);
        const doc = await this.waitForSectionDoc(next);
        if (!doc) {
          // Nếu stop() đã xóa crossing, người dùng chủ động dừng; chỉ cảnh báo khi thật sự hết giờ.
          if (this.crossing) log.warn(`section ${next} iframe not ready in time, stopping`);
          break;
        }
        const paras = segmentParagraphs(doc.body);
        if (paras.length > 0) {
          this.ignoreScrollUntil = performance.now() + AUTO_SCROLL_IGNORE_MS;
          this.startSection(next, paras, 0);
          this.crossing = false;
          return;
        }
        next++; // Bỏ qua section rỗng như trang bìa.
      }
    } finally {
      if (this.crossing) {
        this.crossing = false;
        this.clearHighlight();
        useTtsStore.setState({ status: "idle" }); // Hết sách hoặc lỗi thì về trạng thái dừng.
      }
    }
  }

  private waitForSectionDoc(index: number): Promise<Document | null> {
    return new Promise((resolve) => {
      const deadline = performance.now() + SECTION_DOC_TIMEOUT_MS;
      const tick = () => {
        if (this.crossing === false) return resolve(null); // Đã bị dừng trong lúc chờ.
        const doc = sectionDoc(index);
        if (doc) return resolve(doc);
        if (performance.now() > deadline) return resolve(null);
        setTimeout(tick, SECTION_DOC_POLL_MS);
      };
      tick();
    });
  }

  private onParagraph(i: number): void {
    const para = this.paragraphs[i];
    const doc = sectionDoc(this.sectionIndex);
    if (!para || !doc) return;
    this.applyHighlight(doc, para.element);
    if (!this.followSuspended) this.scrollToParagraph(para.element);
  }

  private applyHighlight(doc: Document, el: Element): void {
    const win = doc.defaultView;
    if (!win?.CSS?.highlights) return;
    const range = doc.createRange();
    range.selectNodeContents(el);
    // Dùng constructor Highlight trong realm của iframe vì đăng ký Range qua realm khác không ổn định.
    win.CSS.highlights.set("tts-current", new win.Highlight(range));
  }

  private clearHighlight(): void {
    const doc = sectionDoc(this.sectionIndex);
    doc?.defaultView?.CSS?.highlights?.delete("tts-current");
  }

  private scrollToParagraph(el: Element): void {
    const frame = sectionFrame(this.sectionIndex);
    const scroller = this.ctx?.getScroller() ?? null;
    if (!frame || !scroller) return;
    const view = scroller.getBoundingClientRect();
    const topMain = frame.getBoundingClientRect().top + el.getBoundingClientRect().top;
    if (topMain >= view.top && topMain <= view.bottom - 80) return; // Đã nằm trong khung nhìn.
    this.ignoreScrollUntil = performance.now() + AUTO_SCROLL_IGNORE_MS;
    scroller.scrollBy({ top: topMain - view.top - view.height / 3 });
  }
}

/** Singleton của module: thanh đầu và thanh điều khiển gọi trực tiếp, trạng thái phát qua useTtsStore.
 *  Khi đổi sách, EpubReader detach để dừng và xóa ctx trước khi attach ngữ cảnh mới.
 */
export const ttsController = new TtsController();
