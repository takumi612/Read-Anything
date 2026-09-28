/**
 * CSS tô sáng đoạn TTS hiện tại chèn vào iframe section bằng Custom Highlight API.
 * Màu cam ấm bán trong suốt đọc được ở cả nền sáng và tối, khác năm màu chú thích.
 */
export const TTS_IFRAME_CSS = `::highlight(tts-current) { background-color: rgba(251, 146, 60, 0.3); }`;
