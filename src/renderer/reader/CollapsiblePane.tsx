import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@renderer/lib/utils";

/** Ánh xạ class vật lý cho ba hướng thu gọn; vị trí, dịch chuyển và viền dùng cùng hệ tọa độ. */
const PEEK = {
  left: {
    pinned: "border-r",
    trigger: "inset-y-0 left-0 w-3",
    handle: "inset-y-0 left-0 w-1",
    drawer: "inset-y-0 left-0 border-r",
    closed: "-translate-x-full",
    resizer: "right-0",
  },
  right: {
    pinned: "border-l",
    trigger: "inset-y-0 right-0 w-3",
    handle: "inset-y-0 right-0 w-1",
    drawer: "inset-y-0 right-0 border-l",
    closed: "translate-x-full",
    resizer: "left-0",
  },
  top: {
    pinned: "border-b",
    trigger: "inset-x-0 top-0 h-3",
    handle: "inset-x-0 top-0 h-1",
    drawer: "inset-x-0 top-0 border-b",
    closed: "-translate-y-full",
    resizer: "",
  },
} as const;

interface CollapsiblePaneProps {
  side: "left" | "right" | "top";
  /** Ghim bảng: true giữ chỗ trong luồng tài liệu, false thu thành ngăn kéo ở mép. */
  open: boolean;
  /** Class kích thước bảng như "w-64" hoặc "h-12"; bỏ qua khi đã truyền width. */
  sizeClass?: string;
  /**
   * Chiều rộng có điều khiển theo px, dùng inline style vì thay đổi liên tục lúc chạy.
   * Áp dụng cho cả chế độ ghim và ngăn kéo. Nếu có onWidthChange, bảng ghim có tay kéo ở mép trong.
   */
  width?: number;
  /** Callback kéo với giá trị px gốc; bên gọi hoặc store chịu trách nhiệm giới hạn. */
  onWidthChange?: (width: number) => void;
  /** aria-label cho vùng kích hoạt ở mép khi bảng thu gọn. */
  label: string;
  /** When true, an open side pane overlays the document below this viewport width. */
  overlayOnSmallScreen?: boolean;
  /** Close callback and accessible label for the small-screen backdrop. */
  onOverlayClose?: () => void;
  overlayCloseLabel?: string;
  /** Disable edge-hover peek when the pane should open only from its explicit toolbar control. */
  peekOnHover?: boolean;
  /**
   * Class thêm vào bảng ở cả hai chế độ. Tránh nền bán trong suốt như bg-muted/30:
   * tailwind-merge sẽ thay nền bg-background của ngăn kéo, khiến nội dung phía sau xuyên qua.
   * Đặt nền trang trí ở phần tử gốc của children như Sidebar hoặc AIPanel.
   */
  className?: string;
  children: ReactNode;
}

/**
 * Bảng thu gọn theo ba hướng, chỉ gắn DOM một lần. Khi ghim, nó giữ chỗ trong luồng tài liệu;
 * khi thu gọn, cùng phần tử trở thành ngăn kéo nổi ở mép. Có thể rê lên vùng mép để mở,
 * rồi tự thu sau 200 ms rời chuột. children không bị tháo nên giữ trạng thái stream và vị trí cuộn.
 * Khi ngăn kéo chưa mở, đặt inert để nội dung ngoài màn hình không nhận Tab hay pointer.
 */
export function CollapsiblePane({
  side,
  open,
  sizeClass,
  width,
  onWidthChange,
  label,
  overlayOnSmallScreen = false,
  onOverlayClose,
  overlayCloseLabel,
  peekOnHover = true,
  className,
  children,
}: CollapsiblePaneProps) {
  const [peekOpen, setPeekOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const c = PEEK[side];
  const smallScreenOverlay = open && overlayOnSmallScreen && side !== "top";

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setPeekOpen(false), 200);
  };

  // Khi ghim, đặt lại trạng thái peek; dọn timer thu gọn khi đổi chế độ hoặc tháo bảng.
  useEffect(() => {
    if (open) setPeekOpen(false);
    return cancelClose;
  }, [open]);

  // Khi kéo đổi chiều rộng, bắt đầu nghe ở mousedown và dừng ở mouseup.
  // Giữ cố định mép đối diện rồi tính chiều rộng mới từ khoảng cách tới vị trí con trỏ.
  const startResize = (e: React.MouseEvent) => {
    if (!onWidthChange || side === "top") return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      onWidthChange(side === "left" ? ev.clientX - rect.left : rect.right - ev.clientX);
    };
    const onUp = () => {
      setResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const resizable = open && width != null && onWidthChange != null && side !== "top";

  return (
    <>
      {smallScreenOverlay && onOverlayClose && (
        <button
          type="button"
          aria-label={overlayCloseLabel ?? label}
          onClick={onOverlayClose}
          className="absolute inset-0 z-30 hidden bg-background/45 max-[900px]:block"
        />
      )}
      {/* Khi thu gọn: vùng kích hoạt 3px ở mép và tay nắm 1px; rê lên để mở ngăn kéo. */}
      {!open && peekOnHover && (
        <div
          aria-label={label}
          onMouseEnter={() => {
            cancelClose();
            setPeekOpen(true);
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
      )}

      {/* Cùng một phần tử bảng; chỉ đổi className giữa chế độ ghim và ngăn kéo nổi. */}
      <div
        ref={panelRef}
        inert={!open && !peekOpen}
        onMouseEnter={open || !peekOnHover ? undefined : cancelClose}
        onMouseLeave={open || !peekOnHover ? undefined : scheduleClose}
        className={cn(
          "border-border",
          open
            ? cn(
                "relative shrink-0",
                c.pinned,
                smallScreenOverlay &&
                  cn(
                    "max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:z-40 max-[900px]:max-w-[420px] max-[520px]:max-w-[88vw] max-[900px]:shadow-xl",
                    side === "left" ? "max-[900px]:left-0" : "max-[900px]:right-0",
                  ),
              )
            : cn(
                "absolute z-40 bg-background shadow-xl transition-transform duration-200 ease-out",
                c.drawer,
                peekOpen ? "translate-x-0 translate-y-0" : c.closed,
              ),
          sizeClass,
          className,
        )}
        // Chiều rộng do người dùng kéo thay đổi liên tục nên không biểu diễn được bằng class tĩnh.
        style={width != null ? { width } : undefined}
      >
        {children}
        {/* Tay kéo 1px ở mép trong khi ghim, sáng lên lúc rê hoặc kéo. */}
        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            onMouseDown={startResize}
            className={cn(
              "absolute inset-y-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/40",
              c.resizer,
              resizing && "bg-primary/40",
            )}
          />
        )}
      </div>

      {/* Lớp phủ toàn màn hình khi kéo nhận pointer thay cho iframe ePub vốn chặn mousemove. */}
      {resizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}
    </>
  );
}
