import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@renderer/components/ui/button";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { APPLICATION_BACKGROUND_MAX_BYTES } from "@shared/app-background";

export function ApplicationBackgroundControls() {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const mode = usePrefsStore((state) => state.appBackgroundMode);
  const color = usePrefsStore((state) => state.appBackgroundColor);
  const blobId = usePrefsStore((state) => state.appBackgroundBlobId);
  const setMode = usePrefsStore((state) => state.setAppBackgroundMode);
  const setColor = usePrefsStore((state) => state.setAppBackgroundColor);
  const setBlobId = usePrefsStore((state) => state.setAppBackgroundBlobId);

  const onFilePicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > APPLICATION_BACKGROUND_MAX_BYTES) {
      toast.error(t("settings.appBackground.tooLarge", "Choose an image up to 8 MB"));
      return;
    }

    setSaving(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await window.api.app.setBackgroundImage(bytes);
      if (result.status === "set") {
        setBlobId(result.blobId);
        setMode("image");
      } else if (result.status === "too-large") {
        toast.error(t("settings.appBackground.tooLarge", "Choose an image up to 8 MB"));
      } else {
        toast.error(t("settings.appBackground.unsupported", "Use a PNG, JPEG, or WebP image"));
      }
    } catch {
      toast.error(t("settings.appBackground.failed", "Couldn't save the background image"));
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await window.api.app.resetBackground();
      setBlobId(null);
      setMode("default");
    } catch {
      toast.error(t("settings.appBackground.failed", "Couldn't reset the application background"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">
          {t("settings.appBackground.title", "Application background")}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            "settings.appBackground.description",
            "Choose a solid color or local image for the library and stats. Application theme is controlled separately; book pages are unchanged.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span>{t("settings.appBackground.color", "Background color")}</span>
          <input
            type="color"
            value={color}
            disabled={saving}
            aria-label={t("settings.appBackground.color", "Background color")}
            className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
            onChange={(event) => {
              setColor(event.target.value);
              setMode("color");
            }}
          />
        </label>

        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={t("settings.appBackground.chooseImage", "Choose background image")}
          className="sr-only"
          onChange={(event) => void onFilePicked(event)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus />
            {saving
              ? t("settings.appBackground.saving", "Saving…")
              : t("settings.appBackground.chooseImage", "Choose image")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("settings.appBackground.reset", "Reset")}
            title={t("settings.appBackground.reset", "Reset")}
            disabled={saving}
            onClick={() => void onReset()}
          >
            <RotateCcw />
            {t("settings.appBackground.reset", "Reset")}
          </Button>
        </div>
        {blobId && mode !== "image" && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => setMode("image")}>
            {t("settings.appBackground.useSavedImage", "Use saved image")}
          </Button>
        )}
      </div>

      {blobId && (
        <div className="flex items-center gap-3 rounded-lg border border-border p-2">
          <img
            src={`media://blob/${encodeURIComponent(blobId)}`}
            alt=""
            className="h-12 w-20 rounded object-cover"
          />
          <span className="text-xs text-muted-foreground">
            {mode === "image"
              ? t("settings.appBackground.activeImage", "Image background is active")
              : t("settings.appBackground.savedImage", "Image saved on this device")}
          </span>
        </div>
      )}
    </section>
  );
}
