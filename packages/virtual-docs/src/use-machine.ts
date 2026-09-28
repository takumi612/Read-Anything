import { useCallback, useEffect, useRef, useState } from "react";

export interface MachineTransition<S, F> {
  next: S;
  effects: F[];
}

/** Bản ghi chẩn đoán cho mỗi lần chuyển trạng thái; bên dùng chuyển tiếp đến logger của họ. */
export interface TransitionRecord {
  event: string;
  from: string;
  to: string;
  effects: string[];
}

export interface UseMachineOptions<S> {
  /** Tạo nhãn một dòng cho trạng thái để ghi log; nếu bỏ qua thì dùng giá trị dự phòng ngoài JSON. */
  describeState?: (state: S) => string;
  onTransition?: (record: TransitionRecord) => void;
}

/**
 * Kết nối reducer thuần và mô tả effect với React: dispatch là lối duy nhất để cập nhật trạng thái;
 * effect chạy theo thứ tự sau commit và mỗi lần chuyển trạng thái được ghi qua onTransition.
 *
 * Gói này không chạy qua React Compiler nên callback nội bộ cần được ổn định bằng useCallback/ref.
 */
export function useMachine<S, E extends { type: string }, F extends { kind: string }>(
  reduce: (state: S, event: E) => MachineTransition<S, F>,
  initial: S,
  runEffect: (effect: F) => void,
  options?: UseMachineOptions<S>,
): [S, (event: E) => void] {
  const runEffectRef = useRef(runEffect);
  runEffectRef.current = runEffect;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Tự quản lý state thay vì dùng useReducer: React có thể gọi reducer nhiều lần trong cùng batch
  // nhưng chỉ commit kết quả cuối, làm mất effect trung gian (mất startTicker có thể khiến Promise treo).
  // raise chạy reducer đồng bộ và xếp effect vào hàng đợi, không phụ thuộc cách batch; raise không phải
  // reducer nên cũng không bị StrictMode gọi hai lần.
  const stateRef = useRef(initial);
  const pending = useRef<F[]>([]);
  const [, forceRender] = useState(0);

  const raise = useCallback((event: E) => {
    const { next, effects } = reduce(stateRef.current, event);
    // Bỏ qua chuyển trạng thái rỗng: không render lại hoặc ghi log. Phần lớn sự kiện cuộn
    // (sau throttle vẫn mỗi 120ms) đều rỗng; xử lý chúng sẽ gây render và log không cần thiết.
    if (next === stateRef.current && effects.length === 0) return;
    const describe = optionsRef.current?.describeState;
    const record: TransitionRecord = {
      event: event.type,
      from: describe ? describe(stateRef.current) : "?",
      to: describe ? describe(next) : "?",
      effects: effects.map((e) => e.kind),
    };
    stateRef.current = next;
    if (effects.length > 0) pending.current.push(...effects);
    optionsRef.current?.onTransition?.(record);
    forceRender((n) => n + 1);
    // Hàm reduce do bên dùng cố định khi mount; giá trị đổi theo render được đọc qua ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pending.current.length === 0) return;
    const queue = pending.current;
    pending.current = [];
    for (const effect of queue) runEffectRef.current(effect);
  });

  return [stateRef.current, raise];
}
