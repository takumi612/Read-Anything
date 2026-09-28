const BOTTOM_TOLERANCE_PX = 4;

export interface ScrollPosition {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

export interface MessageScrollUpdate {
  following: boolean;
  openingConversation: boolean;
  previousLength: number;
  prependedHistory: boolean;
  lastMessageChanged: boolean;
  streamingAssistant: boolean;
}

/**
 * Cách cuộn tới cuối một lần sau khi mở hội thoại.
 *
 * Phải cuộn ngay lập tức. Cuộn mượt phát sự kiện scroll ở từng frame; vài frame đầu vẫn gần đỉnh
 * danh sách vô hạn nên kích hoạt tải lịch sử nhầm. Lúc tải xong, khôi phục điểm neo ghi scrollTop
 * và cắt ngang hoạt ảnh, khiến hội thoại không tới cuối. Cuộn một lần tránh các frame trung gian.
 */
export function conversationOpenScrollBehavior(): "instant" {
  return "instant";
}

export function isScrollAtBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: ScrollPosition): boolean {
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_TOLERANCE_PX;
}

export function messageScrollBehavior({
  following,
  openingConversation,
  previousLength,
  prependedHistory,
  lastMessageChanged,
  streamingAssistant,
}: MessageScrollUpdate): "instant" | null {
  return following &&
    !openingConversation &&
    previousLength > 0 &&
    !prependedHistory &&
    (lastMessageChanged || streamingAssistant)
    ? "instant"
    : null;
}
