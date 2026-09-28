export interface ReadingClockDeps {
  /** Thời gian hiện tại tính bằng ms; truyền vào để kiểm thử. */
  now: () => number;
  /** Ghi số giây đọc sách vào ngày chứa atMs; sink xác định ngày địa phương. */
  commit: (bookId: string, atMs: number, seconds: number) => void;
}

export interface ReadingClock {
  getReadingBook: () => string | null;
  setReadingBook: (bookId: string | null) => void;
  setFocused: (focused: boolean) => void;
  setAwake: (awake: boolean) => void;
  /** Chốt số giây đã tích lũy theo chu kỳ. */
  tick: () => void;
}

/** Máy trạng thái đồng hồ đọc: chỉ chạy khi có sách, cửa sổ được focus và máy không ngủ. */
export function createReadingClock(deps: ReadingClockDeps): ReadingClock {
  let currentBookId: string | null = null;
  let isFocused = false;
  let isAwake = false;
  let activeSince: number | null = null;

  const isActive = () => currentBookId != null && isFocused && isAwake;

  /** Ghi số giây nguyên, giữ phần dưới một giây để phiên dài không bị lệch. */
  function settle(): void {
    if (activeSince == null || !isActive() || currentBookId == null) return;
    const t = deps.now();
    const seconds = Math.floor((t - activeSince) / 1000);
    if (seconds > 0) {
      deps.commit(currentBookId, t, seconds);
      activeSince += seconds * 1000;
    }
  }

  /** Khi đổi trạng thái, chốt thời gian cũ trước rồi đặt lại mốc bắt đầu. */
  function transition(mutate: () => void): void {
    settle();
    mutate();
    activeSince = isActive() ? deps.now() : null;
  }

  return {
    getReadingBook: () => currentBookId,
    setReadingBook: (bookId) => {
      if (currentBookId !== bookId) transition(() => (currentBookId = bookId));
    },
    setFocused: (focused) => {
      if (isFocused !== focused) transition(() => (isFocused = focused));
    },
    setAwake: (awake) => {
      if (isAwake !== awake) transition(() => (isAwake = awake));
    },
    tick: () => settle(),
  };
}
