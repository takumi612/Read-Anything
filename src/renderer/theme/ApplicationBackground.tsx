import { usePrefsStore } from "@renderer/store/prefs-store";
import { resolveApplicationBackground } from "./application-background-state";

/** Decorative background for the library and stats shell; the book reader is intentionally separate. */
export function ApplicationBackground() {
  const mode = usePrefsStore((s) => s.appBackgroundMode);
  const color = usePrefsStore((s) => s.appBackgroundColor);
  const blobId = usePrefsStore((s) => s.appBackgroundBlobId);

  const presentation = resolveApplicationBackground(mode, color, blobId);
  if (!presentation) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundColor: presentation.color, backgroundImage: presentation.imageUrl }}
      />
      {presentation.overlay === "image" && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      )}
    </div>
  );
}
