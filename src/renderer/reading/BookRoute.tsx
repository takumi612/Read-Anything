import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { ReaderView } from "@renderer/reader/ReaderView";
import { resolveBookDestination } from "@renderer/reading/route-state";
import { ReadingStartView } from "@renderer/reading/ReadingStartView";
import { ReadingReportView } from "@renderer/reading/ReadingReportView";

export function BookRoute() {
  const { t } = useTranslation();
  const bookId = useNavigationStore((s) => s.currentBookId);
  const mode = useNavigationStore((s) => s.bookMode);
  const book = useQuery({
    queryKey: qk.book(bookId ?? ""),
    queryFn: () => window.api.library.get({ bookId: bookId! }),
    enabled: bookId != null,
  });
  if (!bookId) {
    return <RouteMessage>{t("reading.routeSelectBook", "Hãy chọn một cuốn sách để đọc.")}</RouteMessage>;
  }
  if (book.isPending) {
    return <RouteMessage>{t("reading.routeLoading", "Đang tải sách…")}</RouteMessage>;
  }
  if (book.isError) {
    return <RouteMessage>{t("reading.routeLoadError", "Không thể tải sách này.")}</RouteMessage>;
  }
  if (!book.data) {
    return <RouteMessage>{t("reading.routeNotFound", "Không tìm thấy sách này.")}</RouteMessage>;
  }
  switch (resolveBookDestination(book.data.readingState, mode)) {
    case "start":
      return <ReadingStartView book={book.data} />;
    case "reader-active":
      return <ReaderView key={bookId} mode="active" />;
    case "reader-reference":
      return <ReaderView key={bookId} mode="reference" />;
    case "report":
      return <ReadingReportView book={book.data} />;
  }
}

function RouteMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen items-center justify-center text-muted-foreground">
      {children}
    </main>
  );
}
