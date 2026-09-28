import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { parseEpub, type TocNode } from "@marginalia/epub-parser";
import { parsePdf, renderPageImage } from "@marginalia/pdf-parser";
import type { DB } from "@main/db/client";
import {
  books,
  chapters,
  confirmedReadingProgress,
  progress,
  readingSessions,
} from "@main/db/schema";
import { deleteBookFile } from "@main/library/book-files";
import { createLogger } from "@main/logger";
import { getBookReadingState } from "@main/reading-sessions/repository";

const log = createLogger("library");

/** Phiên bản parser/chỉ mục; tăng khi cấu trúc đổi để sách cũ được dựng lại khi mở. */
export const CURRENT_PARSER_VERSION = 1;

interface ChapterSeed {
  href: string;
  anchor: string | null;
  title: string | null;
}

/** Trải phẳng mục lục theo DFS, giữ thứ tự và bỏ mục trùng theo href/anchor. */
function chapterSeedsFromToc(toc: TocNode[]): ChapterSeed[] {
  const seeds: ChapterSeed[] = [];
  const seen = new Set<string>();
  const walk = (nodes: TocNode[]): void => {
    for (const n of nodes) {
      const anchor = n.anchor ?? null;
      const key = `${n.href}|${anchor ?? ""}`;
      if (n.href && !seen.has(key)) {
        seen.add(key);
        seeds.push({ href: n.href, anchor, title: n.label || null });
      }
      if (n.children) walk(n.children);
    }
  };
  walk(toc);
  return seeds;
}

/** Tạo danh sách chương từ mục lục; nếu không có thì dùng thứ tự spine với anchor/title null. */
function chapterSeedsFor(parsed: { toc: TocNode[]; spine: { href: string }[] }): ChapterSeed[] {
  const fromToc = chapterSeedsFromToc(parsed.toc);
  if (fromToc.length > 0) return fromToc;
  return parsed.spine.map((s) => ({ href: s.href, anchor: null, title: null }));
}

export interface ImportInput {
  bytes: Uint8Array;
  /** Tên tệp gốc; dùng làm tên sách nếu metadata PDF không có Title. */
  fileName?: string;
}
export type BookRow = typeof books.$inferSelect;
export type ChapterRow = typeof chapters.$inferSelect;

/** Nhận diện định dạng từ magic bytes thay vì đuôi tệp: %PDF- là PDF, PK là EPUB. */
export function detectFormat(bytes: Uint8Array): "epub" | "pdf" {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "pdf";
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "epub";
  throw new Error("not a supported book format (expected ePub or PDF)");
}

export async function importBook(db: DB, input: ImportInput): Promise<BookRow> {
  return detectFormat(input.bytes) === "pdf"
    ? importPdfBook(db, input.bytes, input.fileName)
    : importEpubBook(db, input.bytes);
}

/** Hàm import EPUB đồng bộ; importBook bọc bằng async và phân luồng theo định dạng. */
function importEpubBook(db: DB, bytes: Uint8Array): BookRow {
  const parsed = parseEpub(bytes);
  // ID là hash nội dung như PDF. dc:identifier của EPUB có thể trùng giữa nhiều sách;
  // dùng nó làm khóa chính sẽ khiến sách khác bị nhận nhầm là đã import.
  const id = createHash("sha256").update(bytes).digest("hex");

  // Nếu nội dung tệp đã có, trả sách hiện tại và không ghi lại DB.
  // Chức năng nhập lại để cập nhật dữ liệu cần giữ ID chương ổn định sẽ xử lý riêng.
  const existing = db.select().from(books).where(eq(books.id, id)).get();
  if (existing) return existing;

  return db.transaction((tx) => {
    tx.insert(books)
      .values({
        id,
        title: parsed.title ?? null,
        author: parsed.author ?? null,
        cover: parsed.cover ? Buffer.from(parsed.cover) : null,
        toc: parsed.toc,
        // Sách mới đứng đầu; khi thư viện trống, vị trí đầu là 0.
        position: sql`(coalesce((select min(position) from books), 1) - 1)`,
        parserVersion: CURRENT_PARSER_VERSION,
      })
      .run();

    chapterSeedsFor(parsed).forEach((seed, index) => {
      tx.insert(chapters)
        .values({
          bookId: id,
          href: seed.href,
          anchor: seed.anchor,
          orderIndex: index,
          title: seed.title,
        })
        .run();
    });

    const row = tx.select().from(books).where(eq(books.id, id)).get();
    if (!row) throw new Error("importEpubBook: book row missing after insert");
    return row;
  });
}

async function importPdfBook(db: DB, bytes: Uint8Array, fileName?: string): Promise<BookRow> {
  const parsed = await parsePdf(bytes);
  const id = createHash("sha256").update(bytes).digest("hex"); // PDF dùng hash tệp làm ID.

  const existing = db.select().from(books).where(eq(books.id, id)).get();
  if (existing) return existing;

  // Bìa là ảnh trang đầu; lỗi vẽ bìa không chặn import, thư viện dùng ô dự phòng.
  const cover = await renderPageImage(bytes, 1, { targetWidth: 600 }).catch((err: unknown) => {
    log.warn("pdf cover render failed", err);
    return null;
  });

  // Dùng tên tệp được chọn nếu Title thiếu hoặc chỉ lặp lại tên tệp kèm phần mở rộng.
  const fallbackTitle = fileName?.replace(/\.[^.]+$/, "").trim() || undefined;
  const metadataTitle = parsed.title?.trim() || undefined;
  const filenameLikeExtension = /\.(?:pdf|docx?|odt|rtf|epub|mobi|azw3?|html?|txt|pptx?|xlsx?)$/iu;
  const title =
    metadataTitle && filenameLikeExtension.test(metadataTitle)
      ? (fallbackTitle ?? (metadataTitle.replace(filenameLikeExtension, "").trim() || null))
      : (metadataTitle ?? fallbackTitle ?? null);

  return db.transaction((tx) => {
    tx.insert(books)
      .values({
        id,
        title,
        author: parsed.author ?? null,
        cover: cover ? Buffer.from(cover) : null,
        toc: parsed.toc,
        format: "pdf",
        pageCount: parsed.pageCount,
        hasTextLayer: parsed.hasTextLayer,
        // Sách mới đứng đầu; khi thư viện trống, vị trí đầu là 0.
        position: sql`(coalesce((select min(position) from books), 1) - 1)`,
        parserVersion: CURRENT_PARSER_VERSION,
      })
      .run();

    parsed.chapterRanges.forEach((range, index) => {
      tx.insert(chapters)
        .values({
          bookId: id,
          href: `pdf-ch:${index}`,
          orderIndex: index,
          // Có outline thì dùng nhãn TOC; nếu chỉ một chương thì lấy tên sách làm nhãn.
          title: parsed.toc[index]?.label ?? title,
          startPage: range.startPage,
          endPage: range.endPage,
        })
        .run();
    });

    const row = tx.select().from(books).where(eq(books.id, id)).get();
    if (!row) throw new Error("importPdfBook: book row missing after insert");
    return row;
  });
}

/** Số sách tối đa trên kệ "Đọc tiếp". */
export const RECENT_SHELF_LIMIT = 3;

export function listBooks(db: DB) {
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      hasCover: sql<boolean>`${books.cover} is not null and length(${books.cover}) > 0`,
      format: books.format,
      pageCount: books.pageCount,
      hasTextLayer: books.hasTextLayer,
    })
    .from(books)
    .orderBy(asc(books.position), asc(books.addedAt))
    .all()
    .map((book) => ({ ...book, readingState: getBookReadingState(db, book.id) }));
}

/**
 * Dữ liệu kệ "Đọc tiếp" (#48): JOIN tiến độ và sắp theo lần đọc gần nhất.
 * Sách chưa từng đọc không xuất hiện; renderer xử lý percent null của dữ liệu cũ.
 * Không phân tích locator. Sách đã đánh dấu đọc xong bị loại khỏi kệ (#70).
 */
export function listRecentlyRead(db: DB, limit = RECENT_SHELF_LIMIT) {
  const lastReadAt = sql<number>`max(${progress.updatedAt}, coalesce(${confirmedReadingProgress.updatedAt}, 0))`;
  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      hasCover: sql<boolean>`${books.cover} is not null and length(${books.cover}) > 0`,
      format: books.format,
      pageCount: books.pageCount,
      hasTextLayer: books.hasTextLayer,
      percent: sql<number | null>`case
        when ${progress.percent} is null then ${confirmedReadingProgress.percent}
        when ${confirmedReadingProgress.percent} is null then ${progress.percent}
        else max(${progress.percent}, ${confirmedReadingProgress.percent})
      end`,
      lastReadAt,
    })
    .from(books)
    .innerJoin(progress, eq(progress.bookId, books.id))
    .leftJoin(confirmedReadingProgress, eq(confirmedReadingProgress.bookId, books.id))
    .innerJoin(
      readingSessions,
      and(eq(readingSessions.bookId, books.id), isNull(readingSessions.completedAt)),
    )
    .orderBy(desc(lastReadAt))
    .limit(limit)
    .all()
    .map((book) => ({ ...book, readingState: "reading" as const }));
}

/** Sắp xếp thủ công: ghi lại position theo thứ tự orderedIds; ID lạ không gây thay đổi. */
export function reorderBooks(db: DB, orderedIds: string[]): void {
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(books).set({ position: index }).where(eq(books.id, id)).run();
    });
  });
}
export function getBook(db: DB, id: string): BookRow | undefined {
  return db.select().from(books).where(eq(books.id, id)).get();
}

/**
 * Cập nhật tên sách và tác giả (#29); author=null nghĩa là xóa tên tác giả.
 * Import lại cùng nội dung trả về sớm nên không ghi đè thông tin đã sửa thủ công.
 */
export function updateBook(
  db: DB,
  input: { bookId: string; title: string; author: string | null },
): BookRow {
  const row = db
    .update(books)
    .set({ title: input.title, author: input.author })
    .where(eq(books.id, input.bookId))
    .returning()
    .get();
  if (!row) throw new Error(`library: book ${input.bookId} not found`);
  return row;
}

export function resolveChapterByHref(db: DB, bookId: string, href: string): ChapterRow | undefined {
  return db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.href, href)))
    .get();
}

/** Tìm chương chính xác theo href và anchor; anchor null khớp dòng có anchor IS NULL. */
export function resolveChapter(
  db: DB,
  bookId: string,
  href: string,
  anchor: string | null,
): ChapterRow | undefined {
  return db
    .select()
    .from(chapters)
    .where(
      and(
        eq(chapters.bookId, bookId),
        eq(chapters.href, href),
        anchor === null ? isNull(chapters.anchor) : eq(chapters.anchor, anchor),
      ),
    )
    .get();
}

/**
 * Khi sách EPUB có parserVersion cũ, phân tích lại bytes và dựng chapters/TOC trong transaction.
 * Trả true nếu đã dựng lại; bản mới, sách khác EPUB hoặc lỗi phân tích trả false.
 * Annotation, tiến độ và hội thoại liên kết books.id nên xóa chapters cũ không làm mất chúng.
 */
export function reindexBookIfStale(db: DB, bytes: Uint8Array, bookId: string): boolean {
  const book = getBook(db, bookId);
  if (!book || book.format !== "epub") return false;
  if ((book.parserVersion ?? 0) >= CURRENT_PARSER_VERSION) return false;
  let parsed;
  try {
    parsed = parseEpub(bytes);
  } catch (err) {
    log.warn(`reindex parse failed, keeping old index (book ${bookId})`, err);
    return false;
  }
  db.transaction((tx) => {
    tx.delete(chapters).where(eq(chapters.bookId, bookId)).run();
    chapterSeedsFor(parsed).forEach((seed, index) => {
      tx.insert(chapters)
        .values({
          bookId,
          href: seed.href,
          anchor: seed.anchor,
          orderIndex: index,
          title: seed.title,
        })
        .run();
    });
    tx.update(books)
      .set({ toc: parsed.toc, parserVersion: CURRENT_PARSER_VERSION })
      .where(eq(books.id, bookId))
      .run();
  });
  log.info(`reindexed book ${bookId} to parser v${CURRENT_PARSER_VERSION}`);
  return true;
}

/**
 * Xóa sách: xóa dòng DB trước (các dòng phụ thuộc dùng ON DELETE CASCADE), rồi cố xóa tệp bản sao.
 * Nếu xóa tệp trước mà DB vẫn còn, thư viện sẽ chứa sách không mở được.
 * Sách không tồn tại là no-op để thao tác xóa lặp hoặc đua nhau không gây lỗi.
 */
export async function deleteBook(db: DB, booksDir: string, bookId: string): Promise<void> {
  const book = getBook(db, bookId); // Lấy định dạng trước khi xóa dòng DB.
  db.delete(books).where(eq(books.id, bookId)).run();
  if (book) await deleteBookFile(booksDir, bookId, book.format);
}
