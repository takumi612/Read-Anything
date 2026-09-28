import { PanelLeftOpen } from "lucide-react";
import { Button } from "@renderer/components/ui/button";

export function SidebarReopenButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onPointerDown={onOpen}
      onClick={onOpen}
      aria-label={label}
      aria-expanded={false}
      aria-controls="reader-navigation-sidebar"
      data-testid="sidebar-reopen"
      title={label}
      className="fixed top-1/2 left-0 z-[72] size-11 -translate-y-1/2 rounded-l-none border-l-0 bg-secondary shadow-lg"
    >
      <PanelLeftOpen aria-hidden="true" />
    </Button>
  );
}
