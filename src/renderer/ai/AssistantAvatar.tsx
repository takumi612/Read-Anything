import { usePrefsStore } from "@renderer/store/prefs-store";
import { cn } from "@renderer/lib/utils";
import defaultAvatarUrl from "@renderer/ai/default-avatar.svg";

/**
 * Ảnh đại diện trợ lý dùng media://blob/{id} khi có avatarBlobId; id đổi thì URL tự đổi.
 * Nếu không có thì dùng SVG mặc định. Hình tròn và kích thước do className quyết định.
 */
export function AssistantAvatar({ className }: { className?: string }) {
  const blobId = usePrefsStore((s) => s.avatarBlobId);
  const src = blobId ? `media://blob/${encodeURIComponent(blobId)}` : defaultAvatarUrl;
  return (
    <img
      src={src}
      alt=""
      className={cn("shrink-0 rounded-full object-cover", className)}
      onError={(e) => {
        // Nếu URL media lỗi, dùng SVG mặc định để tránh ảnh hỏng.
        if (e.currentTarget.src !== defaultAvatarUrl) e.currentTarget.src = defaultAvatarUrl;
      }}
    />
  );
}
