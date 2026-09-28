// src/main/ai/background-limiter.ts

/** Chạy fn trong giới hạn đồng thời của tác vụ nền và trả nguyên kết quả/lỗi. */
export type RunBackground = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Bộ giới hạn đồng thời toàn cục: tối đa getLimit() tác vụ chạy, phần còn lại xếp FIFO.
 * Không phụ thuộc Electron/DB. Đọc giới hạn mỗi lần nhận việc mới; thay đổi cài đặt
 * không hủy tác vụ đang chạy.
 */
export class Limiter {
  constructor(private readonly getLimit: () => number) {}

  private active = 0;
  private readonly queue: Array<() => void> = [];

  // Trường arrow giữ this để bên gọi có thể truyền limiter.run như một giá trị.
  run: RunBackground = (fn) =>
    new Promise((resolve, reject) => {
      const attempt = () => {
        this.active++;
        fn().then(
          (value) => {
            this.active--;
            this.pump();
            resolve(value);
          },
          (err: unknown) => {
            this.active--;
            this.pump();
            reject(err);
          },
        );
      };
      if (this.active < this.getLimit()) attempt();
      else this.queue.push(attempt);
    });

  private pump(): void {
    while (this.queue.length > 0 && this.active < this.getLimit()) this.queue.shift()!();
  }
}

export type SlotAcquisition = { ok: true; release: () => void } | { ok: false };

/**
 * Giữ một suất tác vụ nền đến khi release(); nếu chờ quá lâu thì bỏ cuộc.
 * Dùng cho bên gọi cần phương án dự phòng thay vì xếp hàng vô hạn.
 * Khi timeout cũng gọi release để suất đến muộn được trả lại ngay.
 */
export function acquireSlot(run: RunBackground, timeoutMs: number): Promise<SlotAcquisition> {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let granted = () => {};
  const grant = new Promise<void>((resolve) => {
    granted = resolve;
  });
  void run(async () => {
    granted();
    await held;
  }).catch(() => {});

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      release();
      resolve({ ok: false });
    }, timeoutMs);
    void grant.then(() => {
      clearTimeout(timer);
      resolve({ ok: true, release });
    });
  });
}
