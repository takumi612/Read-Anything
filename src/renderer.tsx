import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "./index.css";
import "@renderer/i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@renderer/query/client";
import { useThemeStore } from "@renderer/store/theme-store";
import { App } from "@renderer/App";
import { ErrorBoundary } from "@renderer/ErrorBoundary";
import { createLogger } from "@renderer/logger";

// Áp dụng lớp .dark từ theme-store trước khung hình đầu tiên.
// Renderer đã có DOM và CSS, còn preload có thể chưa có document.documentElement.
// Thực hiện đồng bộ trước createRoot để tránh chớp nền sáng.
document.documentElement.classList.toggle(
  "dark",
  useThemeStore.getState().resolvedTheme === "dark",
);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("renderer: #root not found");

// Ghi cả lỗi ngoài vòng đời component; error boundary chỉ bao phủ cây React.
const windowLog = createLogger("window");
window.onerror = (message, source, lineno, colno, error) => {
  const msg = typeof message === "string" ? message : "script error";
  windowLog.error(`${msg} (${source ?? "?"}:${lineno ?? 0}:${colno ?? 0})`, error);
};
window.addEventListener("unhandledrejection", (ev) => {
  windowLog.error("unhandled promise rejection", ev.reason);
});

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
