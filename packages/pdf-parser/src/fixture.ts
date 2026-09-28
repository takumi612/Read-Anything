import { PDFDocument, PDFHexString, PDFName, PDFObject, StandardFonts } from "pdf-lib";

/** Văn bản mẫu cho từng trang, đủ dài để vượt ngưỡng phát hiện lớp chữ. */
export function fixturePageText(page: number): string {
  return `This is the body text of page ${page}. `.repeat(4).trim();
}

interface TextPdfOptions {
  /** Có mục lục hai chương: Chapter One ở trang 1, Chapter Two ở trang 3. */
  outline: boolean;
  title?: string;
  author?: string;
  pages?: number; // Mặc định 3 trang.
  /** Mục TOC thứ hai trỏ tới ref không tồn tại để kiểm tra parser bỏ qua đích lỗi. */
  brokenDest?: boolean;
  /** Hai mục TOC cùng bắt đầu ở trang 1. */
  samePageChapters?: boolean;
}

/**
 * PDF mẫu có lớp văn bản trên từng trang.
 * Khi có TOC, ghi từ điển /Outlines cấp thấp vì pdf-lib không có API cấp cao.
 * Dest chứa ref của trang; pdfjs dùng getPageIndex để tìm số trang.
 */
export async function makeTextPdf(opts: TextPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pageCount = opts.pages ?? 3;
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(fixturePageText(i), { x: 40, y: 560, size: 12, font, maxWidth: 320 });
  }

  if (opts.outline) {
    const ctx = doc.context;
    const pageRefs = doc.getPages().map((p) => p.ref);
    const entries = [
      { title: "Chapter One", pageIndex: 0 },
      { title: "Chapter Two", pageIndex: opts.samePageChapters ? 0 : 2 },
    ];
    const outlinesRef = ctx.nextRef();
    const itemRefs = entries.map(() => ctx.nextRef());
    entries.forEach((e, i) => {
      const destTarget = opts.brokenDest && i === 1 ? ctx.nextRef() : pageRefs[e.pageIndex]!;
      const dest = ctx.obj([destTarget, PDFName.of("XYZ"), null, null, null]);
      const item: Record<string, PDFObject> = {
        Title: PDFHexString.fromText(e.title),
        Parent: outlinesRef,
        Dest: dest,
      };
      if (i > 0) item.Prev = itemRefs[i - 1]!;
      if (i < entries.length - 1) item.Next = itemRefs[i + 1]!;
      ctx.assign(itemRefs[i]!, ctx.obj(item));
    });
    ctx.assign(
      outlinesRef,
      ctx.obj({
        Type: "Outlines",
        First: itemRefs[0]!,
        Last: itemRefs[itemRefs.length - 1]!,
        Count: entries.length,
      }),
    );
    doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
  }

  return doc.save({ useObjectStreams: false });
}

/** PDF scan mẫu gồm ba trang trống; không có lớp chữ nên hasTextLayer=false. */
export async function makeScannedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([400, 600]);
  return doc.save({ useObjectStreams: false });
}
