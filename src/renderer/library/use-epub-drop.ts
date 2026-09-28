import { useRef, useState, type DragEvent } from "react";
import { isFilesDrag } from "./book-drop";

export interface EpubDropHandlers {
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}

export interface UseEpubDrop {
  /** Tệp đang được kéo vào cửa sổ, cần hiện lớp phủ. */
  isDragging: boolean;
  /** Con trỏ đang trên thẻ thả tệp, cần hiện kiểu kích hoạt. */
  isOverZone: boolean;
  /** Gắn vào khung thư viện để điều khiển lớp phủ và hủy khi thả trên nền tối. */
  rootHandlers: EpubDropHandlers;
  /** Gắn vào thẻ thả tệp để kích hoạt và nhập khi thả trúng. */
  zoneHandlers: EpubDropHandlers;
}

/**
 * State machine kéo thả tệp vào thư viện.
 * - Bộ đếm ở gốc điều khiển lớp phủ, chỉ bật khi dữ liệu kéo chứa tệp bên ngoài.
 * - Bộ đếm ở thẻ điều khiển kiểu kích hoạt. Hai bộ đếm tránh nhấp nháy do sự kiện trên phần tử con.
 * - Thả ở lớp phủ sẽ gọi onFiles(files); thẻ chặn nổi bọt để không nhập hai lần.
 * - dragover phải gọi preventDefault để cho phép drop.
 */
export function useEpubDrop(onFiles: (files: File[]) => void): UseEpubDrop {
  const [isDragging, setDragging] = useState(false);
  const [isOverZone, setOverZone] = useState(false);
  const rootCount = useRef(0);
  const zoneCount = useRef(0);

  const reset = () => {
    rootCount.current = 0;
    zoneCount.current = 0;
    setDragging(false);
    setOverZone(false);
  };

  // Ở mọi điểm thả, đọc tệp đồng bộ trước await, ẩn lớp phủ rồi chuyển cho bên gọi.
  const processDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    reset();
    onFiles(files);
  };

  const rootHandlers: EpubDropHandlers = {
    onDragEnter: (e) => {
      if (!isFilesDrag(e.dataTransfer.types)) return;
      e.preventDefault();
      rootCount.current += 1;
      setDragging(true);
    },
    onDragOver: (e) => {
      if (!isFilesDrag(e.dataTransfer.types)) return;
      e.preventDefault(); // Cho phép thả tệp.
    },
    onDragLeave: (e) => {
      if (!isFilesDrag(e.dataTransfer.types)) return;
      rootCount.current -= 1;
      if (rootCount.current <= 0) reset();
    },
    onDrop: processDrop,
  };

  const zoneHandlers: EpubDropHandlers = {
    onDragEnter: (e) => {
      e.preventDefault();
      zoneCount.current += 1;
      setOverZone(true);
    },
    onDragOver: (e) => {
      e.preventDefault();
    },
    onDragLeave: () => {
      zoneCount.current -= 1;
      if (zoneCount.current <= 0) setOverZone(false);
    },
    onDrop: (e) => {
      // Khi thả trên thẻ, chặn nổi bọt tới rootHandlers.onDrop để tránh nhập hai lần.
      e.stopPropagation();
      processDrop(e);
    },
  };

  return { isDragging, isOverZone, rootHandlers, zoneHandlers };
}
