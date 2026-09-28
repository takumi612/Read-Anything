import { create } from "zustand";
import type { AnnotationStyle } from "@shared/annotations";
import {
  DEFAULT_BACKGROUND_CONCURRENCY,
  DEFAULT_ANNOTATION_COLORS,
  DEFAULT_ANNOTATION_PALETTE,
  DEFAULT_SOUL,
  DEFAULT_STEP_LIMIT,
  DEFAULT_TTS_PREFS,
  type ChatModel,
  type AppBackgroundMode,
  type AnnotationPalette,
  type AnnotationColors,
  type PdfSurroundingBackground,
  type ReaderColorMode,
  type Soul,
  type SummaryModel,
  type TtsPrefs,
} from "@shared/preferences";
import { DEFAULT_WEB_SEARCH, redactWebSearchKeys, type WebSearchConfig } from "@shared/web-search";
import type { ReaderLayout, ReaderPrefs } from "@renderer/types";
import { persistPreference } from "@renderer/store/persist-preference";

interface PrefsState {
  /** Tự tạo tóm tắt khi mở chương; mặc định tắt để kiểm soát chi phí, có hướng dẫn bật khi bắt đầu. */
  autoSummarize: boolean;
  /** Mô hình chat thay cấu hình bảng assistants; null nghĩa là chưa chọn, gửi tin sẽ báo lỗi. */
  chatModel: ChatModel | null;
  aiDataConsent: boolean;
  /** Mô hình tóm tắt chương, cả sách và đặt tên hội thoại; null thì tạo báo lỗi, đặt tên được bỏ qua. */
  summaryModel: SummaryModel | null;
  /** Tùy chọn dàn trang khi đọc: cỡ chữ, giãn dòng và chiều rộng nội dung. */
  prefs: ReaderPrefs;
  /** Kiểu tô sáng dùng lần trước; áp dụng ngay khi chọn công cụ tô sáng như Apple Books. */
  lastHighlightStyle: AnnotationStyle;
  /** Trạng thái bố cục trình đọc: thanh trái, bảng AI và thanh đầu; lưu để khôi phục khi mở lại. */
  layout: ReaderLayout;
  /** Hệ số phóng đại PDF so với chế độ vừa chiều rộng; lưu hệ số, không lưu chỉ số mức. */
  pdfZoom: number;
  /** PDF page-canvas brightness, independent of page tone, EPUB, and the application theme. */
  pdfBrightness: number;
  pdfSurroundingBrightness: number;
  /** Saved PDF-only surround tones and the selected custom tone, if any. */
  pdfSurroundingBackground: PdfSurroundingBackground;
  /** Up to six quick highlight colors shown in the reader toolbar. */
  annotationPalette: AnnotationPalette;
  /** All user-saved highlight colors; separate from the toolbar selection. */
  annotationColors: AnnotationColors;
  /** Chế độ màu trang PDF tách khỏi giao diện ứng dụng; light giữ màu gốc của PDF. */
  pdfColorMode: ReaderColorMode;
  /** Chế độ màu trang EPUB tách khỏi chủ đề ứng dụng và màu trang PDF. */
  epubColorMode: ReaderColorMode;
  appBackgroundMode: AppBackgroundMode;
  appBackgroundColor: string;
  appBackgroundBlobId: string | null;
  restorePdfTabs: boolean;
  /** Giới hạn số bước của vòng lặp agent trong chat; 0 là không giới hạn, được lưu để khôi phục. */
  stepLimit: number;
  /** Giới hạn đồng thời cho các lệnh gọi mô hình nền: tóm tắt, đặt tên, nén; chat trực tiếp không bị giới hạn. */
  backgroundConcurrency: number;
  /** Đã bỏ qua hoặc hoàn tất thẻ hướng dẫn lần đầu; lưu lại để không hiện tiếp. */
  onboardingDismissed: boolean;
  /** Công tắc chính của bộ nhớ AI, mặc định bật. */
  memoryEnabled: boolean;
  /** Tự sắp xếp bộ nhớ sau mỗi N lượt ở nền; mặc định tắt để kiểm soát chi phí. */
  memoryAutoConsolidate: boolean;
  /** Thiết lập nhân dạng agent (SOUL): tên và tính cách. */
  soul: Soul;
  /** Chỉ dẫn chung của người dùng, bổ sung vào tính cách SOUL. */
  instructions: string;
  /** Tùy chọn đọc thành tiếng: tốc độ và ánh xạ ngôn ngữ sang tên giọng. */
  ttsPrefs: TtsPrefs;
  /** Công tắc hiển thị ảnh đại diện trong chat, mặc định bật. */
  showAgentAvatar: boolean;
  /** Blob ảnh đại diện hiện tại; null dùng ảnh mặc định. Main process lưu qua agent IPC, renderer chỉ phản chiếu. */
  avatarBlobId: string | null;
  /** Cấu hình tìm kiếm web gồm enabled và backends; null là giá trị tạm trước khi nạp tùy chọn. */
  webSearch: WebSearchConfig | null;
  /** Công tắc tìm kiếm web của ô soạn tin cho từng tin; lưu để khôi phục khi mở lại. */
  webSearchEnabled: boolean;
}
interface PrefsActions {
  setAutoSummarize: (v: boolean) => void;
  setChatModel: (v: ChatModel) => void;
  setSummaryModel: (v: SummaryModel) => void;
  updatePrefs: (patch: Partial<ReaderPrefs>) => void;
  setLastHighlightStyle: (style: AnnotationStyle) => void;
  updateLayout: (patch: Partial<ReaderLayout>) => void;
  setPdfZoom: (v: number) => void;
  setPdfBrightness: (v: number) => void;
  setPdfSurroundingBrightness: (v: number) => void;
  setPdfSurroundingBackground: (v: PdfSurroundingBackground) => void;
  setAnnotationPalette: (v: AnnotationPalette) => void;
  setAnnotationColors: (v: AnnotationColors) => void;
  setPdfColorMode: (v: ReaderColorMode) => void;
  setEpubColorMode: (v: ReaderColorMode) => void;
  setAppBackgroundMode: (v: AppBackgroundMode) => void;
  setAppBackgroundColor: (v: string) => void;
  setAppBackgroundBlobId: (v: string | null) => void;
  setRestorePdfTabs: (v: boolean) => void;
  setStepLimit: (v: number) => void;
  setBackgroundConcurrency: (v: number) => void;
  setOnboardingDismissed: (v: boolean) => void;
  setMemoryEnabled: (v: boolean) => void;
  setMemoryAutoConsolidate: (v: boolean) => void;
  setSoul: (v: Soul) => void;
  setInstructions: (v: string) => void;
  updateTtsPrefs: (patch: Partial<TtsPrefs>) => void;
  setShowAgentAvatar: (v: boolean) => void;
  setAvatarBlobId: (v: string | null) => void;
  setWebSearch: (v: WebSearchConfig) => void;
  setWebSearchEnabled: (v: boolean) => void;
}

export const PREFS_INITIAL: PrefsState = {
  autoSummarize: false,
  chatModel: null,
  aiDataConsent: false,
  summaryModel: null,
  prefs: { fontScale: 1, lineHeight: 1.9, maxWidth: 640, fontFamily: "default" },
  lastHighlightStyle: "yellow",
  layout: { sidebarOpen: true, panelOpen: false },
  pdfZoom: 1,
  pdfBrightness: 100,
  pdfSurroundingBrightness: 100,
  pdfSurroundingBackground: { colors: [], selectedId: null },
  annotationPalette: DEFAULT_ANNOTATION_PALETTE,
  annotationColors: DEFAULT_ANNOTATION_COLORS,
  pdfColorMode: "light",
  epubColorMode: "system",
  appBackgroundMode: "default",
  appBackgroundColor: "#e2e8e4",
  appBackgroundBlobId: null,
  restorePdfTabs: false,
  stepLimit: DEFAULT_STEP_LIMIT,
  backgroundConcurrency: DEFAULT_BACKGROUND_CONCURRENCY,
  onboardingDismissed: false,
  memoryEnabled: true,
  memoryAutoConsolidate: false,
  soul: DEFAULT_SOUL,
  instructions: "",
  ttsPrefs: DEFAULT_TTS_PREFS,
  showAgentAvatar: true,
  avatarBlobId: null,
  webSearch: DEFAULT_WEB_SEARCH,
  webSearchEnabled: false,
};

/**
 * Store duy nhất cho tùy chọn ứng dụng. Giá trị mặc định chỉ dùng trước khi hydratePreferences
 * nạp từ DB của main process; thay đổi được lưu qua persistPreference vào bảng preferences.
 */
export const usePrefsStore = create<PrefsState & PrefsActions>()((set) => ({
  ...PREFS_INITIAL,
  setAutoSummarize: (autoSummarize) => {
    persistPreference({ key: "autoSummarize", value: autoSummarize });
    set({ autoSummarize });
  },
  setChatModel: (chatModel) => {
    persistPreference({ key: "chatModel", value: chatModel });
    set({ chatModel });
  },
  setSummaryModel: (summaryModel) => {
    persistPreference({ key: "summaryModel", value: summaryModel });
    set({ summaryModel });
  },
  updatePrefs: (patch) =>
    set((s) => {
      const prefs = { ...s.prefs, ...patch };
      persistPreference({ key: "readerPrefs", value: prefs });
      return { prefs };
    }),
  setLastHighlightStyle: (lastHighlightStyle) => {
    persistPreference({ key: "lastHighlightStyle", value: lastHighlightStyle });
    set({ lastHighlightStyle });
  },
  updateLayout: (patch) =>
    set((s) => {
      const layout = { ...s.layout, ...patch };
      persistPreference({ key: "readerLayout", value: layout });
      return { layout };
    }),
  setPdfZoom: (pdfZoom) => {
    persistPreference({ key: "pdfZoom", value: pdfZoom });
    set({ pdfZoom });
  },
  setPdfBrightness: (pdfBrightness) => {
    persistPreference({ key: "pdfBrightness", value: pdfBrightness });
    set({ pdfBrightness });
  },
  setPdfSurroundingBrightness: (pdfSurroundingBrightness) => {
    persistPreference({ key: "pdfSurroundingBrightness", value: pdfSurroundingBrightness });
    set({ pdfSurroundingBrightness });
  },
  setPdfSurroundingBackground: (pdfSurroundingBackground) => {
    persistPreference({ key: "pdfSurroundingBackground", value: pdfSurroundingBackground });
    set({ pdfSurroundingBackground });
  },
  setAnnotationPalette: (annotationPalette) => {
    persistPreference({ key: "annotationPalette", value: annotationPalette });
    set({ annotationPalette });
  },
  setAnnotationColors: (annotationColors) => {
    persistPreference({ key: "annotationColors", value: annotationColors });
    set({ annotationColors });
  },
  setPdfColorMode: (pdfColorMode) => {
    persistPreference({ key: "pdfColorMode", value: pdfColorMode });
    set({ pdfColorMode });
  },
  setEpubColorMode: (epubColorMode) => {
    persistPreference({ key: "epubColorMode", value: epubColorMode });
    set({ epubColorMode });
  },
  setAppBackgroundMode: (appBackgroundMode) => {
    persistPreference({ key: "appBackgroundMode", value: appBackgroundMode });
    set({ appBackgroundMode });
  },
  setAppBackgroundColor: (appBackgroundColor) => {
    persistPreference({ key: "appBackgroundColor", value: appBackgroundColor });
    set({ appBackgroundColor });
  },
  setAppBackgroundBlobId: (appBackgroundBlobId) => set({ appBackgroundBlobId }),
  setRestorePdfTabs: (restorePdfTabs) => {
    persistPreference({ key: "restorePdfTabs", value: restorePdfTabs });
    set({ restorePdfTabs });
  },
  setStepLimit: (stepLimit) => {
    persistPreference({ key: "stepLimit", value: stepLimit });
    set({ stepLimit });
  },
  setBackgroundConcurrency: (backgroundConcurrency) => {
    persistPreference({ key: "backgroundConcurrency", value: backgroundConcurrency });
    set({ backgroundConcurrency });
  },
  setOnboardingDismissed: (onboardingDismissed) => {
    persistPreference({ key: "onboardingDismissed", value: onboardingDismissed });
    set({ onboardingDismissed });
  },
  setMemoryEnabled: (memoryEnabled) => {
    persistPreference({ key: "memoryEnabled", value: memoryEnabled });
    set({ memoryEnabled });
  },
  setMemoryAutoConsolidate: (memoryAutoConsolidate) => {
    persistPreference({ key: "memoryAutoConsolidate", value: memoryAutoConsolidate });
    set({ memoryAutoConsolidate });
  },
  setSoul: (soul) => {
    persistPreference({ key: "soul", value: soul });
    set({ soul });
  },
  setInstructions: (instructions) => {
    persistPreference({ key: "instructions", value: instructions });
    set({ instructions });
  },
  updateTtsPrefs: (patch) =>
    set((s) => {
      const ttsPrefs = { ...s.ttsPrefs, ...patch };
      persistPreference({ key: "ttsPrefs", value: ttsPrefs });
      return { ttsPrefs };
    }),
  setShowAgentAvatar: (showAgentAvatar) => {
    persistPreference({ key: "showAgentAvatar", value: showAgentAvatar });
    set({ showAgentAvatar });
  },
  setAvatarBlobId: (avatarBlobId) => set({ avatarBlobId }),
  setWebSearch: (webSearch) => {
    persistPreference({ key: "webSearch", value: webSearch });
    set({ webSearch: redactWebSearchKeys(webSearch) });
  },
  setWebSearchEnabled: (webSearchEnabled) => {
    persistPreference({ key: "webSearchEnabled", value: webSearchEnabled });
    set({ webSearchEnabled });
  },
}));
