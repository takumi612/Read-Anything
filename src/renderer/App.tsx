import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { usePdfTabsStore } from "@renderer/store/pdf-tabs-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { createLogger } from "@renderer/logger";
import { TooltipProvider } from "@renderer/components/ui/tooltip";
import { hydratePreferences } from "@renderer/store/hydrate-preferences";
import { AppShell } from "@renderer/shell/AppShell";
import { BookRoute } from "@renderer/reading/BookRoute";
import { SettingsShell } from "@renderer/settings/SettingsShell";
import { ThemeController } from "@renderer/theme/ThemeController";
import { Toaster } from "@renderer/components/ui/sonner";
import { useStartupUpdateCheck } from "@renderer/update/useStartupUpdateCheck";
import { useAppNotifications } from "@renderer/notifications/app-notifications";
import { toast } from "sonner";

const log = createLogger("pdf-tabs");

export function App() {
  const { t } = useTranslation();
  const view = useNavigationStore((s) => s.view);
  // Khi khởi động, nạp tùy chọn đã lưu từ DB của main process: cỡ chữ, giãn dòng, bố cục, màu tô sáng và tóm tắt tự động.
  useEffect(() => {
    hydratePreferences();
    const tabs = usePdfTabsStore.getState();
    if (!usePrefsStore.getState().restorePdfTabs) {
      tabs.clear();
      return;
    }
    void window.api.library
      .list()
      .then((books) => {
        const valid = books.filter((book) => book.format === "pdf").map((book) => book.id);
        usePdfTabsStore.getState().retain(valid);
        if (useNavigationStore.getState().view !== "library") return;
        const restored = usePdfTabsStore.getState();
        const target =
          restored.tabs.find((tab) => tab.bookId === restored.activeBookId) ?? restored.tabs.at(-1);
        if (!target) return;
        const navigation = useNavigationStore.getState();
        const finished =
          books.find((book) => book.id === target.bookId)?.readingState === "finished";
        if (target.mode === "active" && !finished) navigation.openBook(target.bookId);
        else navigation.openBookReference(target.bookId);
      })
      .catch((error: unknown) => log.warn("PDF tab restoration failed", error));
  }, []);
  useStartupUpdateCheck();
  useAppNotifications();
  useEffect(
    () =>
      window.api.app.onOpenFile((filePath) => {
        void window.api.library
          .import({ filePath })
          .then((book) => useNavigationStore.getState().openBook(book.id))
          .catch(() =>
            toast.error(
              t(
                "app.openFileFailed",
                "Couldn't open this file. Try importing it from the library.",
              ),
            ),
          );
      }),
    [t],
  );
  return (
    <TooltipProvider>
      <ThemeController />
      {view === "book" ? <BookRoute /> : <AppShell />}
      <SettingsShell />
      <Toaster />
    </TooltipProvider>
  );
}
