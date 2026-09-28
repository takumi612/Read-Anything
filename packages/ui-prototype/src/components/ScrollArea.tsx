import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "#/lib/utils";

/** Thanh cuộn mảnh kiểu macOS tự vẽ: ẩn thanh gốc, phủ một thumb định vị tuyệt đối, tính chiều cao/vị trí theo scroll;
 *  hiện dần khi cuộn / rê chuột, ẩn dần sau 900 ms không thao tác. Không phụ thuộc thư viện, tự theo giao diện.
 *  Giới hạn chiều cao vùng cuộn qua `viewportClassName` (Tailwind, chẳng hạn `max-h-40`).
 *  height/top/opacity của thumb được tính khi chạy; theo quy ước, đây là các giá trị nội tuyến "cần thiết". */
export function ScrollArea({
  children,
  className,
  viewportClassName,
}: {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = useState<{ height: number; top: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const measure = () => {
    const el = viewport.current;
    if (!el) return;
    const { clientHeight, scrollHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const height = Math.max((clientHeight / scrollHeight) * clientHeight, 24);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setThumb({ height, top });
  };

  const reveal = () => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 900);
  };

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={reveal}
      onMouseMove={reveal}
      onMouseLeave={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setVisible(false);
      }}
    >
      <div
        ref={viewport}
        onScroll={() => {
          measure();
          reveal();
        }}
        className={cn("no-scrollbar overflow-y-auto", viewportClassName)}
      >
        {children}
      </div>
      {thumb && (
        <div
          className="pointer-events-none absolute right-1 z-10 w-1.5 rounded-full bg-foreground/35 transition-opacity duration-300"
          style={{ height: thumb.height, top: thumb.top, opacity: visible ? 1 : 0 }}
        />
      )}
    </div>
  );
}
