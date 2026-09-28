import type { AppBackgroundMode } from "@shared/preferences";

export interface ApplicationBackgroundPresentation {
  color: string;
  imageUrl: string | undefined;
  overlay: "color" | "image";
}

/** Resolve the local application wallpaper presentation, with a safe fallback for stale image ids. */
export function resolveApplicationBackground(
  mode: AppBackgroundMode,
  color: string,
  blobId: string | null,
): ApplicationBackgroundPresentation | null {
  if (mode === "default") return null;
  if (mode === "image") {
    if (!blobId) return null;
    return {
      color,
      imageUrl: `url("media://blob/${encodeURIComponent(blobId)}")`,
      overlay: "image",
    };
  }
  return { color, imageUrl: undefined, overlay: "color" };
}
