"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@renderer/lib/utils";

function ScrollArea({
  className,
  viewportClassName,
  viewportRef,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  /** Class chuyển tới Viewport là phần tử cuộn; đặt giới hạn chiều cao như max-h-40 tại đây. */
  viewportClassName?: string;
  /** Ref tới DOM của Viewport để cuộn bằng mã, chẳng hạn xuống cuối AIPanel. */
  viewportRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn("size-full", viewportClassName)}
      >
        {/* Base UI Content đặt min-width: fit-content nội tuyến, có thể gây tràn ngang với truncate/nowrap.
            Các ScrollArea ở đây chỉ cuộn dọc nên ghi đè min-width về 0. */}
        <ScrollAreaPrimitive.Content className="min-w-0!">{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        // Hiện thanh cuộn khi đang cuộn hoặc rê lên rãnh, rồi mờ dần sau khi dừng hoặc rời chuột.
        "z-10 flex touch-none select-none opacity-0 transition-opacity duration-300 hover:opacity-100 data-[scrolling]:opacity-100 data-[scrolling]:duration-0",
        orientation === "vertical" && "h-full w-2.5 justify-center",
        orientation === "horizontal" && "h-2.5 w-full flex-col items-center",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          "rounded-full bg-foreground/35",
          orientation === "vertical" ? "w-1.5" : "h-1.5",
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
