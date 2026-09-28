import ePub, { EpubCFI, type Book } from "epubjs";
import type Section from "epubjs/types/section";
import { htmlToText } from "@marginalia/epub-parser";
import i18n from "@renderer/i18n";
import { createLogger } from "@renderer/logger";
import { readableTextLength } from "./epub-text-position";

const log = createLogger("epub");

/** Class của mark tô sáng; truyền làm ignoreClass khi tính CFI và toRange để mark không đổi đường dẫn. */
export const ANNO_IGNORE_CLASS = "anno";

export interface EpubBook {
  /** Số mục spine, cũng là count của VirtualDocs. */
  count: number;
  /** Độ dài văn bản đọc được của từng mục spine, quét một lần khi tạo sách và giữ đúng thứ tự spine. */
  readonly textLengths: readonly number[];
  /** Vẽ mục spine thứ index thành HTML đã phân giải tài nguyên cho VirtualDocs.loadSection. */
  loadSection: (index: number) => Promise<string>;
  /** Href của mục spine để chapterIdByHref tìm chương và tiến độ hiện tại. */
  hrefAtIndex: (index: number) => string | null;
  /** Tìm chỉ số spine từ href để chuyển chương; trả -1 nếu không thấy. */
  indexOfHref: (href: string) => number;
  /** CFI đầu section để lưu tiến độ; trả null nếu section chưa sẵn sàng. */
  cfiAtIndex: (index: number) => string | null;
  /** Tìm chỉ số spine từ CFI khi khôi phục; trả -1 nếu không hợp lệ hoặc vượt phạm vi. */
  indexOfCfi: (cfi: string) => number;
  /** Đổi Range trong iframe thành CFI cho vùng chọn; trả null nếu thất bại. */
  cfiFromRange: (index: number, range: Range) => string | null;
  /** Đổi chuỗi khoảng CFI thành DOM Range trong section đã cho để vẽ tô sáng; trả null nếu thất bại. */
  rangeFromCfi: (cfi: string, doc: Document) => Range | null;
  /** Độ dài văn bản DOM đọc được trong section, dùng cho tiến độ và trọng số chiều cao ảo; chưa biết thì trả 0. */
  textLengthAtIndex: (index: number) => number;
  /** Độ dài văn bản section sau khi chuẩn hóa như readChapterText; chưa vẽ thì trả 0. */
  chapterTextLengthAtIndex: (index: number) => number;
  /** Tháo tài liệu section thứ index để giải phóng bộ nhớ; an toàn khi gọi lại hoặc ngoài phạm vi. Chỉ dùng với section xa khung nhìn. */
  unloadSection: (index: number) => void;
  /** Tính CFI đầu phần tử trong section để lưu tiến độ theo điểm neo; trả null nếu thất bại. */
  cfiFromElement: (index: number, el: Element) => string | null;
  /** Đảm bảo section đã vẽ rồi tạo point CFI cho phần tử anchorId; trả null nếu thất bại. */
  anchorCfi: (index: number, anchorId: string) => Promise<string | null>;
  /** Giải phóng tài nguyên epubjs, gồm sách và blob URL. */
  destroy: () => void;
}

export interface TextScanSection {
  href: string;
  load: () => Promise<Document>;
  unload: () => void;
}

export interface TextScanWarning {
  index: number;
  href: string;
  error: unknown;
}

export interface SectionTextProfile {
  readableLength: number;
  chapterTextLength: number;
}

/** Bọc load/document/unload của epubjs section thành giao diện quét tuần tự có thể kiểm thử riêng. */
export function adaptTextScanSection(
  index: number,
  section: Pick<Section, "href" | "document" | "load" | "unload"> | null,
  request: NonNullable<Parameters<Section["load"]>[0]>,
): TextScanSection {
  return {
    href: section?.href ?? `spine:${index}`,
    load: async () => {
      if (!section) throw new Error(`Missing EPUB spine section ${index}`);
      await (section.load(request) as unknown as Promise<Element>);
      if (!section.document) throw new Error(`EPUB section has no document: ${section.href}`);
      return section.document;
    },
    unload: () => section?.unload(),
  };
}

/** Quét spine theo thứ tự để lập tọa độ tiến độ và văn bản chương cùng nguồn; section lỗi tính là 0 rồi tiếp tục. */
export async function scanSectionTextProfiles(
  sections: readonly TextScanSection[],
  onWarning: (warning: TextScanWarning) => void,
): Promise<SectionTextProfile[]> {
  const profiles: SectionTextProfile[] = [];
  for (const [index, section] of sections.entries()) {
    try {
      const doc = await section.load();
      profiles.push({
        readableLength: readableTextLength(doc),
        chapterTextLength: htmlToText(doc.documentElement.outerHTML).length,
      });
    } catch (error) {
      profiles.push({ readableLength: 0, chapterTextLength: 0 });
      onWarning({ index, href: section.href, error });
    } finally {
      section.unload();
    }
  }
  return profiles;
}

/** Lấy phần tử khối đầu tiên trong section làm neo cho CFI đầu section. */
function firstBlock(doc: Document): Element {
  return doc.body?.firstElementChild ?? doc.documentElement;
}

/** Lấy tên tệp cuối href sau khi bỏ fragment và query để dự phòng khi ghép href giữa các thư viện. */
function basenameOf(href: string): string {
  const p = href.split("#")[0]!.split("?")[0]!;
  return p.slice(p.lastIndexOf("/") + 1);
}

/**
 * Phân tích byte ePub bằng epubjs và cung cấp giao diện tối thiểu cho vẽ ảo cùng CFI.
 * Chỉ dùng epubjs để phân tích, tải tài nguyên và xử lý CFI; không dùng Rendition/manager.
 */
export async function createEpubBook(bytes: Uint8Array): Promise<EpubBook> {
  // epubjs nhận ArrayBuffer; lấy buffer nền của Uint8Array.
  const book: Book = ePub(bytes.buffer as ArrayBuffer);
  await book.ready;
  // ready chỉ chờ metadata, chưa chờ bảng thay tài nguyên bằng blob URL của cả sách.
  // opened bảo đảm resources.replacements() đã xong, cũng là điều kiện của Rendition trong epubjs.
  // Nếu chỉ chờ ready, section đầu có thể được serialize trước khi có bảng thay thế;
  // ảnh còn đường dẫn tương đối sẽ hỏng vĩnh viễn trong iframe srcDoc, trừ khi tháo rồi vẽ lại.
  // replacements() bắt lỗi từng tài nguyên thành null nên không reject và không cần timeout ở đây.
  await book.opened;

  const spine = book.spine;
  // epubjs Spine có .length lúc chạy nhưng spine.d.ts bản 0.3.93 chưa khai báo, nên cần ép kiểu khi đọc.
  const count: number = (spine as unknown as { length: number }).length;

  const sectionAt = (index: number): Section | null => {
    try {
      // spine.get trả null khi vượt phạm vi dù .d.ts khai báo Section không rỗng; giữ ?? để phòng lỗi.
      return spine.get(index) ?? null;
    } catch {
      return null;
    }
  };

  const request = book.load.bind(book);

  const textProfiles = await scanSectionTextProfiles(
    Array.from({ length: count }, (_, index) =>
      adaptTextScanSection(index, sectionAt(index), request),
    ),
    ({ index, href, error }) =>
      log.warn(`failed to scan readable text in spine ${index} (${href})`, error),
  );
  const textLengths = textProfiles.map((profile) => profile.readableLength);
  const chapterTextLengths = textProfiles.map((profile) => profile.chapterTextLength);

  return {
    count,
    textLengths,

    loadSection: async (index) => {
      const s = sectionAt(index);
      if (!s) return `<p>${i18n.t("reader.sectionMissing", "(Không tìm thấy mục này)")}</p>`;
      // render tạo chuỗi HTML đã phân giải tài nguyên; request dùng book.load.bind(book).
      // section.d.ts 0.3.93 ghi sai kiểu trả về string, trong khi runtime trả Promise<string>;
      // ép theo kiểu thực rồi await. Giữ s.document sau khi vẽ cho cfiAtIndex/cfiFromRange.
      const html = await (s.render(request) as unknown as Promise<string>);
      chapterTextLengths[index] = htmlToText(html).length;
      return html;
    },

    hrefAtIndex: (index) => sectionAt(index)?.href ?? null,

    indexOfHref: (href) => {
      const bare = href.split("#")[0]!;
      // Trước hết tìm chính xác theo href của epubjs; spine.get tự bỏ fragment và tra bảng href.
      const direct = (() => {
        try {
          return spine.get(bare) ?? spine.get(href) ?? null;
        } catch {
          return null;
        }
      })();
      if (direct) return direct.index;
      // Dự phòng: href của epub-parser có tiền tố thư mục OPF, còn section.href của epubjs thì không.
      // Với sách đặt OPF trong thư mục con, tìm chính xác có thể trượt và không chuyển được chương.
      // Khi đó ghép theo tên tệp như chapterIdByHref; nhiều kết quả là mơ hồ nên trả -1.
      const base = basenameOf(bare);
      let found = -1;
      for (let i = 0; i < count; i++) {
        const s = sectionAt(i);
        if (s && basenameOf(s.href) === base) {
          if (found !== -1) return -1;
          found = i;
        }
      }
      return found;
    },

    cfiAtIndex: (index) => {
      const s = sectionAt(index);
      // s.document là undefined trước render dù .d.ts khai báo Document; giữ kiểm tra giá trị.
      if (!s || !s.document) return null;
      try {
        // cfiFromElement không nhận ignoreClass; dùng EpubCFI với ANNO_IGNORE_CLASS
        // để <mark class="anno"> đã chèn không ảnh hưởng đường dẫn CFI.
        return new EpubCFI(firstBlock(s.document), s.cfiBase, ANNO_IGNORE_CLASS).toString();
      } catch {
        return null;
      }
    },

    indexOfCfi: (cfi) => {
      try {
        const parsed = new EpubCFI(cfi);
        const pos = parsed.spinePos;
        return typeof pos === "number" && pos >= 0 ? pos : -1;
      } catch {
        return -1;
      }
    },

    cfiFromRange: (index, range) => {
      const s = sectionAt(index);
      if (!s) return null;
      try {
        // cfiFromRange không nhận ignoreClass; dùng EpubCFI với ANNO_IGNORE_CLASS
        // để <mark class="anno"> đã chèn không ảnh hưởng đường dẫn CFI.
        return new EpubCFI(range, s.cfiBase, ANNO_IGNORE_CLASS).toString();
      } catch {
        return null;
      }
    },

    rangeFromCfi: (cfi, doc) => {
      try {
        // toRange được khai báo trả Range nhưng thực tế trả null nếu thiếu startContainer;
        // dùng ?? null để khớp giao diện Range | null.
        return new EpubCFI(cfi).toRange(doc, ANNO_IGNORE_CLASS) ?? null;
      } catch {
        return null;
      }
    },

    textLengthAtIndex: (index) => textLengths[index] ?? 0,

    chapterTextLengthAtIndex: (index) => chapterTextLengths[index] ?? 0,

    cfiFromElement: (index, el) => {
      const s = sectionAt(index);
      if (!s) return null;
      try {
        return new EpubCFI(el, s.cfiBase, ANNO_IGNORE_CLASS).toString();
      } catch {
        return null;
      }
    },

    anchorCfi: async (index, anchorId) => {
      const s = sectionAt(index);
      if (!s) return null;
      try {
        // s.document chưa có trước render; nếu chưa sẵn sàng thì vẽ như trong loadSection.
        if (!s.document) await (s.render(request) as unknown as Promise<string>);
        const el = s.document?.getElementById(anchorId) ?? null;
        if (!el) return null;
        return new EpubCFI(el, s.cfiBase, ANNO_IGNORE_CLASS).toString();
      } catch {
        return null;
      }
    },

    unloadSection: (index) => {
      const s = sectionAt(index);
      // Nếu s.document chưa tải thì unload không làm gì; epubjs Section.unload trả void.
      if (s) s.unload();
    },

    destroy: () => {
      try {
        book.destroy();
      } catch {
        /* Cố gắng giải phóng tài nguyên. */
      }
    },
  };
}
