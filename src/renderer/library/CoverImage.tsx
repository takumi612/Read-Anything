import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BookSummaryDto } from "@shared/library";
import { coverGradientClass } from "./cover-palette";

/**
 * Hình bìa dùng chung với BookCover và thẻ trên kệ: có bìa thì dùng giao thức cover://,
 * thiếu bìa thì dùng nền chuyển màu. withText=false cho ảnh nhỏ vì chữ trên đó khó đọc.
 */
export function CoverImage({
  book,
  withText = true,
}: {
  book: BookSummaryDto;
  withText?: boolean;
}) {
  const { t } = useTranslation();
  const finishedBadge =
    book.readingState === "finished" ? (
      <span
        aria-label={t("library.finishedBadge", "Đã đọc xong")}
        title={t("library.finishedBadge", "Đã đọc xong")}
        className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    ) : null;

  if (book.hasCover) {
    return (
      <div className="relative">
        <img
          src={`cover://b/${encodeURIComponent(book.id)}`}
          alt=""
          loading="lazy"
          className="aspect-[2/3] w-full object-cover"
        />
        {finishedBadge}
      </div>
    );
  }
  const title = book.title ?? book.id;
  const author = book.author ?? t("library.unknownAuthor", "Không rõ tác giả");
  return (
    <div className="relative">
      <div
        className={`flex aspect-[2/3] w-full flex-col justify-between bg-gradient-to-br ${coverGradientClass(book.id)} p-3 text-white`}
      >
        {withText && (
          <>
            <span className="line-clamp-4 font-serif text-base font-semibold">{title}</span>
            <span className="truncate text-xs text-white/80">{author}</span>
          </>
        )}
      </div>
      {finishedBadge}
    </div>
  );
}
