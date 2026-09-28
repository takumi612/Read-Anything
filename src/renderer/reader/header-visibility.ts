const HEADER_REVEAL_SCROLL_TOP = 8;
const SCROLL_DIRECTION_THRESHOLD = 2;
export const USER_SCROLL_INTENT_WINDOW_MS = 800;

export function hasRecentUserScrollIntent(lastIntentAt: number, now: number): boolean {
  return now - lastIntentAt <= USER_SCROLL_INTENT_WINDOW_MS;
}

/** Pinch zoom is a modified wheel gesture, not a request to move the reader header. */
export function isReadingScrollWheel(
  event: Pick<WheelEvent, "ctrlKey" | "metaKey">,
): boolean {
  return !event.ctrlKey && !event.metaKey;
}

/** Chooses automatic toolbar visibility from the active document's scroll position. */
export function nextHeaderVisibility(
  currentlyVisible: boolean,
  previousScrollTop: number,
  currentScrollTop: number,
): boolean {
  if (currentScrollTop <= HEADER_REVEAL_SCROLL_TOP) return true;

  const delta = currentScrollTop - previousScrollTop;
  if (delta > SCROLL_DIRECTION_THRESHOLD) return false;
  if (delta < -SCROLL_DIRECTION_THRESHOLD) return true;
  return currentlyVisible;
}
