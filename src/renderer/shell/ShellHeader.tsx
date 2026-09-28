import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useSettingsStore } from "@renderer/store/settings-store";
import { SettingsMenuButton } from "@renderer/shell/SettingsMenuButton";

export function ShellHeader() {
  const { t } = useTranslation();
  const view = useNavigationStore((s) => s.view);
  const showLibrary = useNavigationStore((s) => s.showLibrary);
  const showStats = useNavigationStore((s) => s.showStats);
  const openSettings = useSettingsStore((s) => s.setOpen);

  const pill = (active: boolean) =>
    cn(
      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <header className="flex h-14 shrink-0 items-center px-6">
      <div className="flex-1">
        <h1 className="font-serif text-xl font-semibold">{t("library.title", "Read-Anything")}</h1>
      </div>
      <nav className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted p-1">
        <button
          type="button"
          onClick={showLibrary}
          aria-current={view === "library" ? "page" : undefined}
          className={pill(view === "library")}
        >
          {t("shell.tabLibrary", "Thư viện")}
        </button>
        <button
          type="button"
          onClick={showStats}
          aria-current={view === "stats" ? "page" : undefined}
          className={pill(view === "stats")}
        >
          {t("shell.tabStats", "Thống kê")}
        </button>
      </nav>
      <div className="flex flex-1 justify-end">
        <SettingsMenuButton onOpenSettings={() => openSettings(true)} />
      </div>
    </header>
  );
}
