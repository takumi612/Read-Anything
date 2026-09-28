import type { ReactNode } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@renderer/components/ui/hover-card";
import { usePrefsStore } from "@renderer/store/prefs-store";

/**
 * Optional web-search context control. Selected text is attached separately and stays hidden.
 */
function ContextPill(props: {
  icon: ReactNode;
  label: string;
  on: boolean;
  onClick?: () => void;
  ariaPressed?: boolean;
  hover: ReactNode;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <div
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
              props.on
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          />
        }
      >
        {props.onClick ? (
          <button
            type="button"
            onClick={props.onClick}
            aria-pressed={props.ariaPressed}
            className="flex items-center gap-1"
          >
            {props.icon}
            {props.label}
          </button>
        ) : (
          <span className="flex items-center gap-1">
            {props.icon}
            {props.label}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent>{props.hover}</HoverCardContent>
    </HoverCard>
  );
}

/**
 * Công tắc tìm kiếm web tùy chọn trong Composer. Vùng chọn và sách hiện tại tự cung cấp ngữ cảnh còn lại cho AI.
 */
export function ContextPillBar() {
  const { t } = useTranslation();
  const webSearchEnabled = usePrefsStore((s) => s.webSearchEnabled);
  const setWebSearchEnabled = usePrefsStore((s) => s.setWebSearchEnabled);
  const webSearchConfigured = usePrefsStore((s) => Boolean(s.webSearch?.backends.length));
  if (!webSearchConfigured) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      <ContextPill
        icon={<Globe className="size-3" />}
        label={t("ai.webSearch.toggle", "Web")}
        on={webSearchEnabled}
        onClick={() => setWebSearchEnabled(!webSearchEnabled)}
        ariaPressed={webSearchEnabled}
        hover={
          <p className="text-muted-foreground">
            {t("ai.webSearch.hover", "Cho phép trợ lý tìm kiếm trên web (Exa)")}
          </p>
        }
      />
    </div>
  );
}
