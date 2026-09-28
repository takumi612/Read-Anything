import type { ComponentProps } from "react";
import { cn } from "@renderer/lib/utils";
import { modKeyLabel } from "@renderer/lib/platform";

/** Nhãn phím theo kiểu shadcn, hiển thị một phím như ⌘, Ctrl hoặc Enter. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-sm border border-border bg-muted px-1 font-sans text-[0.7rem] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Khung xếp nhiều Kbd theo hàng ngang với khoảng cách đều. */
export function KbdGroup({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex items-center gap-1", className)} {...props} />;
}

/** Kbd của phím bổ trợ chính: macOS hiện ⌘, nền tảng khác hiện Ctrl; chuyển tiếp className. */
export function ModKey(props: ComponentProps<"kbd">) {
  return <Kbd {...props}>{modKeyLabel}</Kbd>;
}
