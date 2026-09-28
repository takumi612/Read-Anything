import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@renderer/store/lazy-storage";

/**
 * Giới hạn và chiều rộng mặc định của từng bảng theo px. Giá trị mặc định giữ kích thước cũ:
 * thanh bên 256px và bảng AI 384px. min giữ nội dung đủ chỗ, max giữ vùng đọc còn hiển thị.
 */
export const PANE_LIMITS = {
  sidebar: { min: 200, max: 480, default: 256 },
  panel: { min: 280, max: 600, default: 384 },
} as const;
export type PaneId = keyof typeof PANE_LIMITS;

/** Giới hạn chiều rộng sau khi kéo vào phạm vi hợp lệ; giá trị không hữu hạn về mặc định. */
export function clampPaneWidth(pane: PaneId, width: number): number {
  const { min, max, default: fallback } = PANE_LIMITS[pane];
  if (!Number.isFinite(width)) return fallback;
  return Math.min(max, Math.max(min, Math.round(width)));
}

interface PaneSizeState {
  /** Chiều rộng thanh bên trái của trình đọc, tính bằng px. */
  sidebarWidth: number;
  /** Chiều rộng bảng trợ lý AI trong trình đọc, tính bằng px. */
  panelWidth: number;
}
interface PaneSizeActions {
  setSidebarWidth: (width: number) => void;
  setPanelWidth: (width: number) => void;
}

/**
 * Kích thước bảng là state giao diện, lưu bằng zustand persist trong localStorage.
 * Trạng thái bật tắt như sidebarOpen vẫn nằm ở prefs-store.
 */
export const usePaneSizeStore = create<PaneSizeState & PaneSizeActions>()(
  persist(
    (set) => ({
      sidebarWidth: PANE_LIMITS.sidebar.default,
      panelWidth: PANE_LIMITS.panel.default,
      setSidebarWidth: (width) => set({ sidebarWidth: clampPaneWidth("sidebar", width) }),
      setPanelWidth: (width) => set({ panelWidth: clampPaneWidth("panel", width) }),
    }),
    { name: "marginalia-pane-sizes", storage: safeStorage },
  ),
);
