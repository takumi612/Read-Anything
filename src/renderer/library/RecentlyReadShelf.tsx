import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { qk } from "@renderer/query/keys";
import { createLogger } from "@renderer/logger";
import { CoverImage } from "./CoverImage";

const log = createLogger("library");

/**
 * Kệ đọc tiếp hiển thị tối đa ba sách đọc gần đây kèm tiến độ.
 * Ẩn khi không có lịch sử hoặc truy vấn lỗi; staleTime 0 lấy lại khi trở về thư viện.
 * Kệ chỉ là một cách hiển thị nên sách vẫn xuất hiện trong lưới bên dưới.
 */
export function RecentlyReadShelf({ onOpen }: { onOpen: (bookId: string) => void }) {
  const { t } = useTranslation();
  const recent = useQuery({
    queryKey: qk.recentlyRead,
    queryFn: () => window.api.library.recentlyRead(),
    staleTime: 0,
  });

  // Khi truy vấn lỗi, ẩn kệ và ghi warn dù giao diện vẫn hoạt động.
  useEffect(() => {
    if (recent.error) log.warn("recently read query failed", recent.error);
  }, [recent.error]);

  if (!recent.data?.length) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("library.continueReading", "Đọc tiếp")}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recent.data.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => onOpen(b.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="w-12 shrink-0 overflow-hidden rounded">
                <CoverImage book={b} withText={false} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-sm font-semibold">{b.title ?? b.id}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.author ?? t("library.unknownAuthor", "Không rõ tác giả")}
                </p>
                {b.percent != null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      {/* Chiều rộng thanh tiến độ được tính lúc chạy. */}
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(b.percent * 100)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {Math.round(b.percent * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
