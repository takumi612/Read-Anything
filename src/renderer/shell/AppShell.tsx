import { useNavigationStore } from "@renderer/store/navigation-store";
import { LibraryView } from "@renderer/library/LibraryView";
import { StatsView } from "@renderer/stats/StatsView";
import { ShellHeader } from "@renderer/shell/ShellHeader";
import { ApplicationBackground } from "@renderer/theme/ApplicationBackground";

export function AppShell() {
  const view = useNavigationStore((s) => s.view);
  return (
    <div className="relative isolate flex h-screen flex-col bg-transparent font-sans text-foreground">
      <ApplicationBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <ShellHeader />
        <div className="min-h-0 flex-1">{view === "stats" ? <StatsView /> : <LibraryView />}</div>
      </div>
    </div>
  );
}
