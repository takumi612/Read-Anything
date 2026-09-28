import { Component, type ReactNode } from "react";
import i18n from "@renderer/i18n";
import { createLogger } from "@renderer/logger";

const log = createLogger("boundary");

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Khi cây component lỗi, ghi log và hiện màn hình thử tải lại. React Error Boundary vẫn cần class component. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    log.error(
      `component tree crashed${info.componentStack ? `\n${info.componentStack}` : ""}`,
      error,
    );
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 font-sans">
          <p className="text-lg font-medium">{i18n.t("app.errorBoundary.title")}</p>
          <button
            type="button"
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            onClick={() => window.location.reload()}
          >
            {i18n.t("app.errorBoundary.reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
