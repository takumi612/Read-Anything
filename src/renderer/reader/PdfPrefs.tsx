import { useTranslation } from "react-i18next";
import { Minus, Plus, ZoomIn } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@renderer/components/ui/popover";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { clampPdfZoom, PDF_ZOOM_STEP } from "./pdf-zoom";

/**
 * Ô nhập phần trăm zoom như trình xem PDF của trình duyệt: nhấn để chọn hết, Enter hoặc mất focus để áp dụng.
 * Không điều khiển bằng state; key=display gắn lại khi zoom hợp lệ đổi, còn nhập sai hoặc cùng giá trị thì tự khôi phục.
 */
function ZoomValueInput({ zoom, onCommit }: { zoom: number; onCommit: (pct: number) => void }) {
  const { t } = useTranslation();
  const display = `${Math.round(zoom * 100)}%`;
  return (
    <input
      key={display}
      type="text"
      inputMode="numeric"
      defaultValue={display}
      aria-label={t("reader.pdf.zoom", "Thu phóng")}
      className="w-12 bg-transparent text-center text-xs tabular-nums outline-none"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={(e) => {
        // Chấp nhận "85%" hoặc " 85 "; không lưu số không hợp lệ hay không dương.
        const pct = Number.parseFloat(e.currentTarget.value.replace(/[^\d.]/g, ""));
        if (Number.isFinite(pct) && pct > 0) onCommit(pct);
        e.currentTarget.value = display; // Khôi phục khi nhập sai hoặc sau giới hạn vẫn cùng giá trị.
      }}
    />
  );
}

/** Bảng tùy chọn đọc PDF mở từ thanh đầu, hiện chỉ có độ phóng đại. */
export function PdfPrefs() {
  const { t } = useTranslation();
  const pdfZoom = usePrefsStore((s) => s.pdfZoom);
  const setPdfZoom = usePrefsStore((s) => s.setPdfZoom);
  const bookId = useNavigationStore((s) => s.currentBookId);
  const fitMode =
    useNavigationStore((s) => (bookId ? s.pdfFitModeByBook[bookId] : undefined)) ?? "custom";
  const effectiveZoom = useNavigationStore((s) =>
    bookId ? s.pdfEffectiveZoomByBook[bookId] : undefined,
  );
  const zoom = effectiveZoom ?? clampPdfZoom(pdfZoom);
  const label = t("reader.pdf.zoom", "Thu phóng");

  const setCustomZoom = (next: number) => {
    if (bookId) useNavigationStore.getState().setPdfFitMode(bookId, "custom");
    setPdfZoom(clampPdfZoom(next));
  };
  const step = (delta: number) => setCustomZoom(zoom + delta);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label={t("reader.prefs.title", "Tùy chọn đọc")}
          />
        }
      >
        <ZoomIn />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-60 space-y-2">
        <div className="flex gap-1">
          <Button
            variant={fitMode === "width" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => bookId && useNavigationStore.getState().setPdfFitMode(bookId, "width")}
          >
            {t("reader.pdf.fitWidth")}
          </Button>
          <Button
            variant={fitMode === "page" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => bookId && useNavigationStore.getState().setPdfFitMode(bookId, "page")}
          >
            {t("reader.pdf.fitPage")}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => step(-PDF_ZOOM_STEP)}
              aria-label={t("reader.prefs.decrease", "Giảm {{label}}", { label })}
            >
              <Minus />
            </Button>
            <ZoomValueInput zoom={zoom} onCommit={(pct) => setCustomZoom(pct / 100)} />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => step(PDF_ZOOM_STEP)}
              aria-label={t("reader.prefs.increase", "Tăng {{label}}", { label })}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
