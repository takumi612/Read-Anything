import { DEFAULT_WEB_SEARCH } from "@shared/web-search";
import { DEFAULT_ANNOTATION_COLORS } from "@shared/preferences";
import { usePrefsStore } from "@renderer/store/prefs-store";

/**
 * Khi khởi động, nạp tùy chọn từ snapshot đồng bộ của main process; khóa thiếu hoặc hỏng giữ mặc định.
 * Preload lấy và cache snapshot bằng sendSync trước frame đầu, rồi getAll trả đồng bộ.
 * Dùng setState trực tiếp để không kích hoạt lưu lại qua action; gọi một lần khi App gắn.
 * colorMode được theme-store xử lý riêng từ cùng snapshot lúc khởi tạo.
 */
export function hydratePreferences(): void {
  if (typeof window === "undefined" || !window.api?.preferences) return;
  const snap = window.api.preferences.getAll();
  if (snap.readerPrefs) usePrefsStore.setState({ prefs: snap.readerPrefs });
  if (snap.readerLayout) usePrefsStore.setState({ layout: snap.readerLayout });
  if (snap.lastHighlightStyle) {
    usePrefsStore.setState({ lastHighlightStyle: snap.lastHighlightStyle });
  }
  const annotationPalette = snap.annotationPalette ?? usePrefsStore.getState().annotationPalette;
  const annotationColors = snap.annotationColors ?? DEFAULT_ANNOTATION_COLORS;
  usePrefsStore.setState({
    annotationPalette,
    // Keep palettes from older releases manageable after saved colors became a separate preference.
    annotationColors: [...new Set([...annotationColors, ...annotationPalette])],
  });
  if (snap.autoSummarize !== undefined) {
    usePrefsStore.setState({ autoSummarize: snap.autoSummarize });
  }
  if (snap.chatModel) usePrefsStore.setState({ chatModel: snap.chatModel });
  if (snap.aiDataConsent !== undefined) {
    usePrefsStore.setState({ aiDataConsent: snap.aiDataConsent });
  }
  if (snap.summaryModel) usePrefsStore.setState({ summaryModel: snap.summaryModel });
  if (snap.pdfZoom !== undefined) usePrefsStore.setState({ pdfZoom: snap.pdfZoom });
  if (snap.pdfBrightness !== undefined) {
    usePrefsStore.setState({ pdfBrightness: snap.pdfBrightness });
  }
  if (snap.pdfSurroundingBrightness !== undefined) {
    usePrefsStore.setState({ pdfSurroundingBrightness: snap.pdfSurroundingBrightness });
  }
  if (snap.pdfSurroundingBackground !== undefined) {
    usePrefsStore.setState({ pdfSurroundingBackground: snap.pdfSurroundingBackground });
  }
  if (snap.pdfColorMode !== undefined) usePrefsStore.setState({ pdfColorMode: snap.pdfColorMode });
  // Preserve the prior EPUB appearance for existing installs, then store it independently.
  if (snap.epubColorMode !== undefined) {
    usePrefsStore.setState({ epubColorMode: snap.epubColorMode });
  } else if (snap.colorMode !== undefined) {
    usePrefsStore.getState().setEpubColorMode(snap.colorMode);
  }
  if (snap.appBackgroundMode !== undefined) {
    usePrefsStore.setState({ appBackgroundMode: snap.appBackgroundMode });
  }
  if (snap.appBackgroundColor !== undefined) {
    usePrefsStore.setState({ appBackgroundColor: snap.appBackgroundColor });
  }
  if (snap.appBackgroundBlobId !== undefined) {
    usePrefsStore.setState({ appBackgroundBlobId: snap.appBackgroundBlobId });
  }
  if (snap.restorePdfTabs !== undefined) {
    usePrefsStore.setState({ restorePdfTabs: snap.restorePdfTabs });
  }
  if (snap.stepLimit !== undefined) usePrefsStore.setState({ stepLimit: snap.stepLimit });
  if (snap.backgroundConcurrency !== undefined) {
    usePrefsStore.setState({ backgroundConcurrency: snap.backgroundConcurrency });
  }
  if (snap.onboardingDismissed !== undefined) {
    usePrefsStore.setState({ onboardingDismissed: snap.onboardingDismissed });
  }
  if (snap.memoryEnabled !== undefined) {
    usePrefsStore.setState({ memoryEnabled: snap.memoryEnabled });
  }
  if (snap.memoryAutoConsolidate !== undefined) {
    usePrefsStore.setState({ memoryAutoConsolidate: snap.memoryAutoConsolidate });
  }
  if (snap.soul) usePrefsStore.setState({ soul: snap.soul });
  if (snap.instructions !== undefined) usePrefsStore.setState({ instructions: snap.instructions });
  if (snap.ttsPrefs) usePrefsStore.setState({ ttsPrefs: snap.ttsPrefs });
  if (snap.showAgentAvatar !== undefined) {
    usePrefsStore.setState({ showAgentAvatar: snap.showAgentAvatar });
  }
  if (snap.avatarBlobId !== undefined) {
    usePrefsStore.setState({ avatarBlobId: snap.avatarBlobId });
  }
  usePrefsStore.setState({ webSearch: snap.webSearch ?? DEFAULT_WEB_SEARCH });
  if (snap.webSearchEnabled !== undefined) {
    usePrefsStore.setState({ webSearchEnabled: snap.webSearchEnabled });
  }
}
