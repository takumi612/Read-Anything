import { protocol } from "electron";
import { getDb } from "@main/db/instance";
import { blobResponseFor } from "@main/media/blob-store";

/**
 * Đăng ký media://blob/<blobId> để đọc bytes từ bảng blob.
 * Host lạ hoặc ID thiếu trả 404. Gọi sau app.ready và initDb vì handler cần DB.
 */
export function registerMediaProtocol(): void {
  protocol.handle("media", (request) => {
    const url = new URL(request.url);
    if (url.host !== "blob") return new Response(null, { status: 404 });
    const id = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const hit = blobResponseFor(getDb(), id);
    if (!hit) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(hit.bytes), {
      headers: { "content-type": hit.contentType },
    });
  });
}
