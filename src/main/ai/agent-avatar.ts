import type { DB } from "@main/db/client";
import type { AvatarPickResult } from "@shared/agent";
import { sniffImageType } from "@main/library/cover-bytes";
import { writeBlob, deleteBlob } from "@main/media/blob-store";
import { getPreference, setPreference } from "@main/preferences/repository";

/** Giới hạn ảnh đại diện tải lên: 2 MB. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Kiểm tra và lưu ảnh mới, đổi avatarBlobId rồi xóa blob cũ. */
export function storeAvatar(db: DB, bytes: Uint8Array): AvatarPickResult {
  if (bytes.byteLength > AVATAR_MAX_BYTES) return { status: "too-large" };
  const mime = sniffImageType(bytes);
  if (!ALLOWED.has(mime)) return { status: "unsupported" };
  const prev = getPreference(db, "avatarBlobId");
  const blobId = writeBlob(db, bytes, mime);
  setPreference(db, "avatarBlobId", blobId);
  if (prev) deleteBlob(db, prev);
  return { status: "set", blobId };
}

/** Đặt lại ảnh mặc định: xóa blob hiện tại và đặt avatarBlobId=null. */
export function resetAvatar(db: DB): void {
  const prev = getPreference(db, "avatarBlobId");
  setPreference(db, "avatarBlobId", null);
  if (prev) deleteBlob(db, prev);
}
