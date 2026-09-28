import { useEffect, useRef, useState } from "react";

/** Popover tối giản: trạng thái mở/đóng và đóng khi nhấp bên ngoài. Ref gắn vào vùng định vị tương đối của nút kích hoạt. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return { open, setOpen, ref };
}
