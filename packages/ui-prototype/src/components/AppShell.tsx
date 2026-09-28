import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelTopClose,
  PanelTopOpen,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { ReaderAIProvider, useReaderAI } from "#/reader-ai-context";
import { Sidebar } from "#/components/sidebar/Sidebar";
import { ReaderPane } from "#/components/reader/ReaderPane";
import { AIPanel } from "#/components/ai-panel/AIPanel";
import { ThemeToggle } from "#/components/ThemeToggle";
import { SettingsPopover } from "#/components/SettingsPopover";
import { LanguageSwitcher } from "#/components/LanguageSwitcher";
import { cn } from "#/lib/utils";

export function AppShell() {
  return (
    <ReaderAIProvider>
      <div className="grid min-h-screen place-items-center p-4">
        <div className="island-shell relative flex h-[88vh] w-[min(1440px,96vw)] flex-col overflow-hidden rounded-2xl">
          <Shell />
        </div>
      </div>
    </ReaderAIProvider>
  );
}

function Shell() {
  const { headerOpen } = useReaderAI();
  return (
    <>
      {/* Trạng thái ghim: thanh đầu chiếm chỗ trong luồng tài liệu */}
      {headerOpen && <TopBar />}
      <Workspace />
      {/* Trạng thái thu gọn: ngăn kéo ở mép trên khi rê chuột */}
      {!headerOpen && (
        <PeekDrawer side="top" sizeClass="h-12">
          <TopBar />
        </PeekDrawer>
      )}
    </>
  );
}

function TopBar() {
  const { t } = useTranslation();
  const {
    book,
    currentChapterId,
    sidebarOpen,
    setSidebarOpen,
    panelOpen,
    setPanelOpen,
    headerOpen,
    setHeaderOpen,
  } = useReaderAI();
  const chapter = book.chapters.find((c) => c.id === currentChapterId);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 font-sans backdrop-blur">
      {/* Công tắc cột trái: trạng thái bật/tắt cùng vị trí, chỉ đổi biểu tượng */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? t("nav.collapseSidebar") : t("nav.expandSidebar")}
      >
        {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
      </Button>

      <div className="display-title text-lg font-bold tracking-tight text-foreground">
        Marginalia
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        {t("app.badge")}
      </span>

      {/* Breadcrumb: sách · chương hiện tại (cập nhật khi cuộn; nội dung sách không dùng i18n) */}
      <div className="ml-3 hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
        <span className="size-1 shrink-0 rounded-full bg-border" />
        <span className="truncate">
          {book.title} · {chapter?.title}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <SettingsPopover />
        <LanguageSwitcher />
        <ThemeToggle />
        {/* Công tắc cột phải: trạng thái bật/tắt cùng vị trí, chỉ đổi biểu tượng */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPanelOpen(!panelOpen)}
          aria-label={panelOpen ? t("nav.collapsePanel") : t("nav.expandPanel")}
        >
          {panelOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
        {/* Thu gọn/ghim thanh đầu: đọc tập trung */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHeaderOpen(!headerOpen)}
          aria-label={headerOpen ? t("nav.collapseHeader") : t("nav.expandHeader")}
        >
          {headerOpen ? <PanelTopClose className="size-4" /> : <PanelTopOpen className="size-4" />}
        </Button>
      </div>
    </header>
  );
}

function Workspace() {
  const { sidebarOpen, panelOpen } = useReaderAI();
  return (
    <div className="relative flex min-h-0 flex-1">
      {/* Trạng thái ghim: chiếm chỗ trong luồng tài liệu */}
      {sidebarOpen && (
        <aside className="w-64 shrink-0 border-r border-border">
          <Sidebar />
        </aside>
      )}
      <main className="min-w-0 flex-1">
        <ReaderPane />
      </main>
      {panelOpen && (
        <aside className="w-[380px] shrink-0 border-l border-border">
          <AIPanel />
        </aside>
      )}

      {/* Trạng thái thu gọn: ngăn kéo nổi được kích hoạt khi rê chuột ở cạnh */}
      {!sidebarOpen && (
        <PeekDrawer side="left" sizeClass="w-64">
          <Sidebar />
        </PeekDrawer>
      )}
      {!panelOpen && (
        <PeekDrawer side="right" sizeClass="w-[380px]">
          <AIPanel />
        </PeekDrawer>
      )}
    </div>
  );
}

const PEEK = {
  left: {
    trigger: "inset-y-0 left-0 w-3",
    handle: "inset-y-0 left-0 w-1",
    drawer: "inset-y-0 left-0 border-r border-border",
    closed: "-translate-x-full",
  },
  right: {
    trigger: "inset-y-0 right-0 w-3",
    handle: "inset-y-0 right-0 w-1",
    drawer: "inset-y-0 right-0 border-l border-border",
    closed: "translate-x-full",
  },
  top: {
    trigger: "inset-x-0 top-0 h-3",
    handle: "inset-x-0 top-0 h-1",
    drawer: "inset-x-0 top-0 border-b border-border",
    closed: "-translate-y-full",
  },
} as const;

/** Ngăn kéo ở trạng thái thu gọn: rê chuột vào vùng kích hoạt mảnh ở cạnh → ngăn kéo trượt vào và nổi trên nội dung; rời đi một lúc thì thu gọn. */
function PeekDrawer({
  side,
  sizeClass,
  children,
}: {
  side: "left" | "right" | "top";
  sizeClass: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const c = PEEK[side];

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  return (
    <>
      {/* Vùng kích hoạt ở cạnh + tay nắm mảnh (luôn gợi ý vị trí, sáng lên khi rê chuột) */}
      <div
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        className={cn("group absolute z-30", c.trigger)}
      >
        <div
          className={cn(
            "absolute bg-border/60 transition-colors group-hover:bg-primary/40",
            c.handle,
          )}
        />
      </div>

      {/* Phần thân ngăn kéo */}
      <div
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={cn(
          "absolute z-40 bg-background shadow-xl transition-transform duration-200 ease-out",
          c.drawer,
          sizeClass,
          open ? "translate-x-0 translate-y-0" : c.closed,
        )}
      >
        {children}
      </div>
    </>
  );
}
