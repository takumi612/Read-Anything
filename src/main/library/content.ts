import { and, asc, eq, gt } from "drizzle-orm";
import {
  extractBookText,
  extractChapterAcrossSpine,
  type ReadOptions,
} from "@marginalia/epub-parser";
import { extractPdfText } from "@marginalia/pdf-parser";
import type { DB } from "@main/db/client";
import { books, chapters } from "@main/db/schema";
import { getBook, resolveChapter } from "@main/library/repository";
import { tocNodeSchema, type TocNode } from "@shared/types";
import type { ChapterRefDto, ChapterTextSlice } from "@shared/library";
import { t } from "@main/i18n";
import { createLogger } from "@main/logger";

const log = createLogger("library");

export function getToc(db: DB, bookId: string): TocNode[] {
  const row = db.select({ toc: books.toc }).from(books).where(eq(books.id, bookId)).get();
  // Kiểm tra cột JSON bằng Zod khi đọc để phát hiện dữ liệu lệch schema.
  // Because tocNodeSchema is recursive, a node whose *any* descendant fails validation causes the
  // entire top-level entry to be dropped — intentional defensive degradation for now; surgical
  // subtree pruning is a future follow-up.
  return (row?.toc ?? []).filter((n) => {
    const result = tocNodeSchema.safeParse(n);
    if (!result.success) {
      const firstPath = result.error.issues[0]?.path.join(".") ?? "(unknown)";
      log.warn(`toc node failed validation, skipped (book ${bookId}): ${firstPath}`);
    }
    return result.success;
  });
}

export async function readChapterText(
  db: DB,
  bytes: Uint8Array,
  bookId: string,
  chapterId: string,
  opts: ReadOptions,
): Promise<ChapterTextSlice> {
  const book = getBook(db, bookId);
  if (!book) throw new Error(`content: book ${bookId} not found`);
  const ch = db
    .select({
      href: chapters.href,
      anchor: chapters.anchor,
      orderIndex: chapters.orderIndex,
      startPage: chapters.startPage,
      endPage: chapters.endPage,
    })
    .from(chapters)
    .where(and(eq(chapters.bookId, bookId), eq(chapters.id, chapterId)))
    .get();
  if (!ch) throw new Error(`content: chapter ${chapterId} not found in book ${bookId}`);
  if (book.format === "pdf") {
    // PDF scan không có lớp chữ: báo nguyên nhân thật thay vì trả văn bản rỗng.
    if (!book.hasTextLayer) {
      throw new Error(t("errors.noTextLayer", "PDF được quét không có lớp văn bản nên không thể trích xuất nội dung"));
    }
    return extractPdfText(bytes, {
      startPage: ch.startPage ?? 1,
      endPage: ch.endPage ?? book.pageCount ?? 1,
      offset: opts.offset,
      maxChars: opts.maxChars,
    });
  }
  // Chương EPUB kéo dài từ (href, anchor) hiện tại đến trước mục TOC kế tiếp,
  // ghép theo thứ tự spine. Tệp spine ở giữa không có mục TOC riêng vẫn thuộc chương;
  // extractChapterAcrossSpine lấy cả chúng. Chương cuối đọc tới hết sách.
  let end: { href: string; anchor?: string } | undefined;
  if (ch.orderIndex != null) {
    const next = db
      .select({ href: chapters.href, anchor: chapters.anchor })
      .from(chapters)
      .where(and(eq(chapters.bookId, bookId), gt(chapters.orderIndex, ch.orderIndex)))
      .orderBy(asc(chapters.orderIndex))
      .limit(1)
      .get();
    if (next) end = { href: next.href, anchor: next.anchor ?? undefined };
  }
  return extractChapterAcrossSpine(
    bytes,
    { href: ch.href, anchor: ch.anchor ?? undefined },
    end,
    opts,
  );
}

/**
 * Lấy văn bản cả sách theo thứ tự spine, giới hạn ở maxChars.
 * Dùng extractBookText để chỉ giải nén EPUB một lần; gọi extractChapterText từng chương
 * sẽ giải nén lại N lần và có thể chặn main process.
 */
export async function readBookText(
  db: DB,
  bytes: Uint8Array,
  bookId: string,
  opts: { maxChars: number },
): Promise<{ text: string; truncated: boolean }> {
  const book = getBook(db, bookId);
  if (!book) throw new Error(`content: book ${bookId} not found`);
  if (book.format === "pdf") {
    // PDF scan không có lớp chữ: báo nguyên nhân thật thay vì trả văn bản rỗng.
    if (!book.hasTextLayer) {
      throw new Error(t("errors.noTextLayer", "PDF được quét không có lớp văn bản nên không thể trích xuất nội dung"));
    }
    const slice = await extractPdfText(bytes, {
      startPage: 1,
      endPage: book.pageCount ?? 1,
      maxChars: opts.maxChars,
    });
    return { text: slice.text, truncated: slice.hasMore };
  }
  const rows = db
    .select({ href: chapters.href })
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(asc(chapters.orderIndex))
    .all();
  const seen = new Set<string>();
  const hrefs = rows.map((r) => r.href).filter((h) => (seen.has(h) ? false : (seen.add(h), true)));
  return extractBookText(bytes, hrefs, opts);
}

/**
 * Chặn tóm tắt rỗng cho PDF scan không có lớp văn bản (spec §8).
 */
export function assertTextLayer(db: DB, bookId: string): void {
  const book = getBook(db, bookId);
  // Sách không tồn tại cũng phải ném lỗi để renderer nhận được reject,
  // nếu không tác vụ nền chỉ ghi warn và UI sẽ kẹt ở pending.
  if (!book) throw new Error(`content: book ${bookId} not found`);
  if (!book.hasTextLayer) {
    throw new Error(t("errors.noTextLayer", "PDF được quét không có lớp văn bản nên không thể trích xuất nội dung"));
  }
}

/**
 * Liệt kê chương để điều hướng theo TOC, không coi mọi tệp spine là một chương.
 * Spine còn có bìa, bản quyền và trang phân cách; TOC lồng nhau dùng level để biểu diễn cấp.
 * Khi nhiều mục TOC trỏ cùng tệp spine, giữ mục đầu nếu đường đọc hiện tại chưa hỗ trợ anchor.
 * EPUB không có TOC thì dùng thứ tự spine và UI tự đặt tên chương khi title thiếu.
 */
export function listChapters(db: DB, bookId: string): ChapterRefDto[] {
  const out: ChapterRefDto[] = [];
  const seen = new Set<string>();
  const walk = (nodes: TocNode[], level: number): void => {
    for (const n of nodes) {
      if (n.href && n.label) {
        const ch = resolveChapter(db, bookId, n.href, n.anchor ?? null);
        if (!ch) {
          log.warn(
            `toc entry not found in chapters (book ${bookId}, href ${n.href}, anchor ${n.anchor ?? "∅"})`,
          );
        } else if (!seen.has(ch.id)) {
          seen.add(ch.id);
          out.push({
            id: ch.id,
            title: n.label,
            href: ch.href,
            anchor: ch.anchor ?? null,
            orderIndex: ch.orderIndex ?? 0,
            level,
            startPage: ch.startPage ?? null,
            endPage: ch.endPage ?? null,
          });
        }
      }
      if (n.children) walk(n.children, level + 1);
    }
  };
  walk(getToc(db, bookId), 0);
  if (out.length > 0) return out;

  // Không có TOC: dùng thứ tự spine, title để trống.
  return db
    .select({
      id: chapters.id,
      title: chapters.title,
      href: chapters.href,
      anchor: chapters.anchor,
      orderIndex: chapters.orderIndex,
      startPage: chapters.startPage,
      endPage: chapters.endPage,
    })
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(asc(chapters.orderIndex))
    .all()
    .map((c) => ({
      id: c.id,
      title: c.title,
      href: c.href,
      anchor: c.anchor ?? null,
      orderIndex: c.orderIndex ?? 0,
      level: 0,
      startPage: c.startPage ?? null,
      endPage: c.endPage ?? null,
    }));
}
