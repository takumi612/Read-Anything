import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { getCroppedBlob } from "@renderer/ai/get-cropped-blob";
import { createLogger } from "@renderer/logger";

const log = createLogger("avatar");

/** Hộp cắt ảnh đại diện với mặt nạ tròn tỉ lệ 1:1 và zoom; xác nhận sẽ gọi onConfirm(bytes). */
export function AvatarCropDialog({
  open,
  imageSrc,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  imageSrc: string | null;
  onConfirm: (bytes: Uint8Array<ArrayBuffer>) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!imageSrc || !area) return;
    setBusy(true);
    try {
      const bytes = await getCroppedBlob(imageSrc, area);
      await onConfirm(bytes);
      onOpenChange(false);
    } catch (err) {
      log.warn("crop failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.agent.avatarCropTitle", "Cắt ảnh đại diện")}</DialogTitle>
        </DialogHeader>
        <div className="relative h-64 w-full overflow-hidden rounded-md bg-muted">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setArea(areaPixels)}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label={t("settings.agent.avatarZoom", "Thu phóng")}
          className="w-full accent-primary"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Hủy")}
          </Button>
          <Button onClick={confirm} disabled={busy || !area}>
            {t("common.save", "Lưu")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
