import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Bộ theo dõi hiệu năng tạm thời trong dev, đo chi phí vẽ và cuộn danh sách tin AI.
 *
 * Gắn gần ScrollArea trong AIPanel:
 *   <ChatPerfMonitor messages={messages} />
 *
 * In báo cáo vào console DevTools mỗi 5 giây và hiện lớp phủ nhỏ ở góc trên bên phải.
 */
type AnyMessage = { id: string; role: string };

interface PerfSnapshot {
  messageCount: number;
  lastRenderMs: number | null;
  longTasks: number;
  longTaskTotalMs: number;
  maxLongTaskMs: number;
  scrollFrames: number;
  scrollEvents: number;
  avgScrollFps: number | null;
}

export function ChatPerfMonitor({ messages }: { messages: AnyMessage[] }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<PerfSnapshot>({
    messageCount: messages.length,
    lastRenderMs: null,
    longTasks: 0,
    longTaskTotalMs: 0,
    maxLongTaskMs: 0,
    scrollFrames: 0,
    scrollEvents: 0,
    avgScrollFps: null,
  });

  const lastRenderStartRef = useRef<number | null>(null);
  const longTaskStatsRef = useRef({ count: 0, total: 0, max: 0 });
  const scrollStatsRef = useRef({ frames: 0, events: 0, lastEventTime: 0 });
  const reportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Đo thời gian từ khi tin đổi tới khi layout và paint xong.
  // useLayoutEffect nhận lúc DOM đã cập nhật, rAF nhận frame đầu được vẽ.
  useLayoutEffect(() => {
    const start = lastRenderStartRef.current ?? performance.now();
    const count = messages.length;
    requestAnimationFrame(() => {
      const end = performance.now();
      setSnapshot((prev) => ({
        ...prev,
        messageCount: count,
        lastRenderMs: Math.round(end - start),
      }));
    });
  }, [messages]);

  useEffect(() => {
    lastRenderStartRef.current = performance.now();
  }, [messages]);

  // PerformanceObserver theo dõi long task chặn luồng chính trên 50 ms.
  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return;
    if (!("PerformanceLongTaskTiming" in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskStatsRef.current.count += 1;
        longTaskStatsRef.current.total += entry.duration;
        longTaskStatsRef.current.max = Math.max(longTaskStatsRef.current.max, entry.duration);
      }
      setSnapshot((prev) => ({
        ...prev,
        longTasks: longTaskStatsRef.current.count,
        longTaskTotalMs: Math.round(longTaskStatsRef.current.total),
        maxLongTaskMs: Math.round(longTaskStatsRef.current.max),
      }));
    });

    try {
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Một số môi trường Electron hoặc DevTools không hỗ trợ longtask.
    }

    return () => observer.disconnect();
  }, []);

  // Đếm FPS khi cuộn qua rAF liên tục; tổng kết sau 300 ms không có cuộn.
  useEffect(() => {
    const viewport = document.querySelector(".ai-messages-viewport") as HTMLElement | null;
    if (!viewport) return;

    const state = {
      counting: false,
      frameCount: 0,
      rafId: null as number | null,
      timeoutId: null as ReturnType<typeof setTimeout> | null,
    };

    const stop = () => {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.counting = false;
      state.rafId = null;
    };

    const tick = () => {
      state.frameCount += 1;
      state.rafId = requestAnimationFrame(tick);
    };

    const flush = () => {
      scrollStatsRef.current.frames += state.frameCount;
      const avg =
        scrollStatsRef.current.events > 0
          ? Math.round((scrollStatsRef.current.frames / scrollStatsRef.current.events) * 10) / 10
          : null;
      setSnapshot((prev) => ({
        ...prev,
        scrollFrames: scrollStatsRef.current.frames,
        scrollEvents: scrollStatsRef.current.events,
        avgScrollFps: avg,
      }));
      stop();
    };

    const onScroll = () => {
      scrollStatsRef.current.events += 1;
      scrollStatsRef.current.lastEventTime = performance.now();
      if (!state.counting) {
        state.counting = true;
        state.frameCount = 0;
        state.rafId = requestAnimationFrame(tick);
      }
      if (state.timeoutId) clearTimeout(state.timeoutId);
      state.timeoutId = setTimeout(() => {
        if (performance.now() - scrollStatsRef.current.lastEventTime >= 280) {
          flush();
        }
      }, 300);
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      if (state.timeoutId) clearTimeout(state.timeoutId);
      stop();
    };
  }, []);

  // In báo cáo có cấu trúc vào console mỗi 5 giây.
  useEffect(() => {
    reportIntervalRef.current = setInterval(() => {
      // eslint-disable-next-line no-console
      console.log("[ChatPerf]", JSON.stringify(snapshot));
    }, 5000);
    return () => {
      if (reportIntervalRef.current) clearInterval(reportIntervalRef.current);
    };
  }, [snapshot]);

  return (
    <div className="pointer-events-none fixed right-3 top-14 z-50 rounded-md border border-border bg-background/90 px-2 py-1 text-[10px] tabular-nums text-foreground shadow-sm backdrop-blur">
      <div>
        {t("chatPerf.messages")}: {snapshot.messageCount}
      </div>
      <div>
        {t("chatPerf.render")}: {snapshot.lastRenderMs ?? "-"} {t("chatPerf.milliseconds")}
      </div>
      <div>
        {t("chatPerf.long")}: {snapshot.longTasks} / {snapshot.longTaskTotalMs}{" "}
        {t("chatPerf.milliseconds")}
      </div>
      <div>
        {t("chatPerf.longMax")}: {snapshot.maxLongTaskMs} {t("chatPerf.milliseconds")}
      </div>
      <div>
        {t("chatPerf.scrollFps")}: {snapshot.avgScrollFps ?? "-"}
      </div>
    </div>
  );
}
