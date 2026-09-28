import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { EpubCFI } from "epubjs";
import { createLogger } from "@renderer/logger";
import { qk } from "@renderer/query/keys";
import type { ChapterRefDto } from "@shared/library";
import { type AnchorBoundary } from "./chapter-id-at-cfi";
import { basename } from "./chapter-id-by-href";
import { createEpubBook, type EpubBook } from "./epub-book";

const log = createLogger("epub");

export interface EpubSession {
  book: EpubBook | null;
  /** Các href theo thứ tự vật lý của spine; rỗng khi sách chưa sẵn sàng hoặc không phải ePub. */
  spineHrefs: string[];
  anchorBoundaries: AnchorBoundary[];
  parseError: string | null;
  /** Bản sao tệp của ứng dụng bị thiếu; EpubReader dựa vào đó để hiện bảng báo thiếu tệp. */
  bytesMissing: boolean;
  bytesError: boolean;
}

const EpubSessionContext = createContext<EpubSession | null>(null);

export function useEpubSession(): EpubSession {
  const ctx = useContext(EpubSessionContext);
  if (!ctx) throw new Error("useEpubSession must be used within EpubSessionProvider");
  return ctx;
}

/**
 * Instance sách thuộc state trong phạm vi ReaderView; EpubReader và AnnotationsList cùng sử dụng.
 * Chỉ tạo instance cho ePub. Với PDF, book=null và spineHrefs rỗng; PdfReader không dùng context này.
 */
export function EpubSessionProvider({
  bookId,
  enabled,
  children,
}: {
  bookId: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [anchorBoundaries, setAnchorBoundaries] = useState<AnchorBoundary[]>([]);
  const chapters = useQuery({
    queryKey: qk.chapters(bookId),
    queryFn: () => window.api.content.chapters({ bookId }),
    staleTime: Infinity,
    enabled,
  });

  const bytes = useQuery({
    queryKey: qk.bookBytes(bookId),
    queryFn: () => window.api.library.readBookBytes({ bookId }),
    staleTime: Infinity,
    enabled,
  });

  useEffect(() => {
    // Khi xem PDF, Provider bị tắt nhưng truy vấn bytes chia sẻ qk.bookBytes với PdfReader.
    // Observer tắt vẫn có thể đọc byte PDF từ cache; phải chặn createEpubBook với dữ liệu này.
    // epubjs có thể treo khi phân tích byte không phải ZIP, còn PDF.js chuyển buffer sang worker
    // làm nó bị detach. Vì vậy chỉ tạo book cho ePub.
    if (!enabled || !bytes.data?.ok) return;
    const fileBytes = bytes.data.data;
    let alive = true;
    let created: EpubBook | null = null;
    setParseError(null);
    createEpubBook(fileBytes)
      .then((b) => {
        if (!alive) {
          b.destroy();
          return;
        }
        created = b;
        setBook(b);
      })
      .catch((err: unknown) => {
        if (alive) {
          log.error("epub parse failed", err);
          setParseError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      alive = false;
      created?.destroy();
      setBook(null);
      setParseError(null); // Xóa lỗi cũ khi đổi hoặc phân tích lại sách.
    };
  }, [enabled, bytes.data]);

  // Các chương chung href cần CFI ở từng neo để xác định chú thích thuộc chương nào.
  // Sau khi mở sách, vẽ section liên quan, tính CFI đầu mỗi chương có neo rồi sắp theo CFI.
  // Trước khi xong, thanh bên tạm ghép theo href.
  useEffect(() => {
    if (!book || !chapters.data) {
      setAnchorBoundaries([]);
      return;
    }
    const chs = chapters.data;
    let alive = true;
    void (async () => {
      try {
        const byBase = new Map<string, ChapterRefDto[]>();
        for (const c of chs) {
          const base = basename(c.href);
          const list = byBase.get(base) ?? [];
          list.push(c);
          byBase.set(base, list);
        }
        const out: AnchorBoundary[] = [];
        for (const group of byBase.values()) {
          if (group.length <= 1) continue;
          const withAnchor = group.filter((c) => c.anchor);
          if (withAnchor.length === 0) continue;
          const index = book.indexOfHref(group[0]!.href);
          if (index < 0) continue;
          for (const c of withAnchor) {
            const cfi = await book.anchorCfi(index, c.anchor!);
            if (cfi) out.push({ chapterId: c.id, cfi });
          }
        }
        const epub = new EpubCFI();
        out.sort((a, b) => epub.compare(a.cfi, b.cfi));
        if (alive) setAnchorBoundaries(out);
      } catch (err) {
        log.warn("anchor boundary precompute failed", err);
        if (alive) setAnchorBoundaries([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [book, chapters.data]);

  const spineHrefs = book
    ? Array.from({ length: book.count }, (_, i) => book.hrefAtIndex(i) ?? "")
    : [];

  return (
    <EpubSessionContext.Provider
      value={{
        book,
        spineHrefs,
        anchorBoundaries,
        parseError,
        bytesMissing: bytes.data?.ok === false,
        bytesError: bytes.isError,
      }}
    >
      {children}
    </EpubSessionContext.Provider>
  );
}
