import { protocol } from "electron";
import { getDb } from "@main/db/instance";
import { coverResponseFor } from "@main/library/cover-bytes";

/**
 * Đăng ký cover://b/<bookId> để trả ảnh từ books.cover.
 * Gọi sau app.ready và initDb vì handler cần DB.
 */
export function registerCoverProtocol(): void {
  protocol.handle("cover", (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ""));
    const hit = coverResponseFor(getDb(), id);
    if (!hit) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(hit.bytes), {
      headers: { "content-type": hit.contentType },
    });
  });
}
