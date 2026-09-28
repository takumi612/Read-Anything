import { useRef, type SyntheticEvent } from "react";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";

/**
 * Kiểm tra thao tác có thật sự bắt đầu trong cây DOM của node hay không.
 *
 * Listener kích hoạt của dnd-kit nằm trên phần tử kéo thả và nhận sự kiện tổng hợp của React.
 * Portal như dialog hoặc menu là con trong cây React nên sự kiện nổi bọt về phần tử kéo thả,
 * nhưng DOM của chúng nằm ở body. Dùng contains để kiểm tra target thực sự có nằm trong
 * phần tử kéo thả hay chỉ là sự kiện đi qua từ lớp nổi.
 *
 * Hàm thuần chỉ gọi contains của node, không cần DOM toàn cục nên kiểm thử độc lập được.
 */
export function gestureStartedWithin(
  node: HTMLElement | null,
  target: EventTarget | null,
): boolean {
  // Node.contains(null) trả false; target của sự kiện pointer và bàn phím là Element.
  return node != null && node.contains(target as Node | null);
}

/**
 * Chỉ cho listener dnd-kit nhận thao tác bắt đầu trong DOM của phần tử kéo thả.
 * Sự kiện nổi bọt từ Portal như dialog, menu hoặc lớp nổi sẽ bị bỏ qua để thao tác trên đó
 * không kéo phần tử chủ. Đặt bộ lọc ở phía nhận thao tác kéo để mọi phần tử dùng hook đều được bảo vệ.
 *
 * Cách dùng:
 *   const { attributes, listeners, setNodeRef, ... } = useSortable({ id });
 *   const guard = useDragGuard(setNodeRef, listeners);
 *   <li ref={guard.setNodeRef} {...attributes} {...guard.listeners}>…</li>
 *
 * Bọc mọi listener kích hoạt, không chỉ onPointerDown, nên cũng chặn Space/Enter trong ô nhập của Portal.
 * setNodeRef kết hợp ref của dnd-kit với nodeRef cục bộ; React Compiler ghi nhớ callback.
 */
export function useDragGuard(
  setNodeRef: (node: HTMLElement | null) => void,
  listeners: DraggableSyntheticListeners,
) {
  const nodeRef = useRef<HTMLElement | null>(null);

  const setGuardedNodeRef = (node: HTMLElement | null) => {
    nodeRef.current = node;
    setNodeRef(node);
  };

  // Bọc từng handler trong listeners để kiểm tra target rồi chuyển tiếp nguyên tham số.
  const guardedListeners =
    listeners &&
    (Object.fromEntries(
      Object.entries(listeners).map(([name, handler]) => [
        name,
        (event: SyntheticEvent, ...rest: unknown[]) => {
          if (!gestureStartedWithin(nodeRef.current, event.target)) return;
          (handler as (...args: unknown[]) => void)(event, ...rest);
        },
      ]),
    ) as NonNullable<DraggableSyntheticListeners>);

  return { setNodeRef: setGuardedNodeRef, listeners: guardedListeners };
}
