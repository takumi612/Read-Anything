import type { DB } from "@main/db/client";
import type { ApplicationBackgroundPickResult } from "@shared/app-background";
import { APPLICATION_BACKGROUND_MAX_BYTES } from "@shared/app-background";
import { sniffImageType } from "@main/library/cover-bytes";
import { deleteBlob, writeBlob } from "@main/media/blob-store";
import { getPreference, setPreference } from "@main/preferences/repository";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Validate and store a local wallpaper, replacing the previous blob without touching book data. */
export function storeApplicationBackground(
  db: DB,
  bytes: Uint8Array,
): ApplicationBackgroundPickResult {
  if (bytes.byteLength > APPLICATION_BACKGROUND_MAX_BYTES) return { status: "too-large" };
  const mime = sniffImageType(bytes);
  if (!ALLOWED.has(mime)) return { status: "unsupported" };

  const previous = getPreference(db, "appBackgroundBlobId");
  const blobId = writeBlob(db, bytes, mime);
  setPreference(db, "appBackgroundBlobId", blobId);
  setPreference(db, "appBackgroundMode", "image");
  if (previous) deleteBlob(db, previous);
  return { status: "set", blobId };
}

/** Remove the local wallpaper and restore the default application background. */
export function resetApplicationBackground(db: DB): void {
  const previous = getPreference(db, "appBackgroundBlobId");
  setPreference(db, "appBackgroundBlobId", null);
  setPreference(db, "appBackgroundMode", "default");
  if (previous) deleteBlob(db, previous);
}
