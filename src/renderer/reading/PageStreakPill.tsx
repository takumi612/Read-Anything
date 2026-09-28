import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import type { PageStreakDto } from "@shared/stats";

export function PageStreakPill({
  streak,
  onClick,
}: {
  streak: PageStreakDto;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const lit = streak.pagesToday >= streak.goal;
  const label = lit
    ? t("streak.readerLit", { days: streak.currentStreak })
    : t("streak.readerProgress", { pages: streak.pagesToday, goal: streak.goal });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Flame
        aria-hidden="true"
        className={lit ? "size-4 text-orange-500" : "size-4 text-muted-foreground"}
      />
      <span className={lit ? "text-foreground" : undefined}>
        {streak.pagesToday}/{streak.goal}
      </span>
    </Button>
  );
}
