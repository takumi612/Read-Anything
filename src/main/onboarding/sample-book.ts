import { type Zippable, strToU8, zipSync } from "fflate";
import type { UILanguage } from "@shared/i18n/language";

/**
 * Nội dung sách mẫu theo một ngôn ngữ: tên, dc:language và ba chương.
 * Các trường được chèn thẳng vào XML nên chỉ dùng chuỗi cố định không có ký tự đặc biệt XML.
 */
interface SampleContent {
  identifier: string;
  bookTitle: string;
  /** Giá trị dc:language trong OPF. */
  lang: string;
  navTitle: string;
  chapters: { id: string; title: string; bodyHtml: string }[];
}

const EN: SampleContent = {
  identifier: "urn:uuid:marginalia-sample-en",
  bookTitle: "The Margin — A Sample Reader",
  lang: "en",
  navTitle: "Contents",
  chapters: [
    {
      id: "ch1",
      title: "I. On Reading in the Margins",
      bodyHtml:
        "<h1>I. On Reading in the Margins</h1>" +
        "<p>A book is never quite finished on the day it is printed. It waits, patiently, for a reader who will argue with it, underline it, and scribble in the white space along its edges. Those edges have a name: the margins. For centuries they were where readers kept their truest thoughts.</p>" +
        "<p>To read in the margins is to refuse to be a passive guest. You stop, you doubt, you ask a question the author never anticipated. The page becomes a conversation rather than a lecture, and the conversation can last for years.</p>" +
        "<p>Try it now. Choose any sentence on this page that interests you, and ask what it assumes, what it leaves out, or what it would mean if it were false. The smallest question, asked honestly, can unlock the whole paragraph.</p>" +
        "<p>The best marginalia are not summaries. They are surprises — the moment you notice that two distant ideas secretly rhyme, or that a confident claim rests on a quiet, unexamined leap. Keep your pencil close. The next surprise is usually one sentence away.</p>",
    },
    {
      id: "ch2",
      title: "II. A Question Worth Keeping",
      bodyHtml:
        "<h1>II. A Question Worth Keeping</h1>" +
        "<p>Not every question deserves an answer on the spot. Some are worth keeping — carried from page to page, turned over in the dark, allowed to ripen. A good reader collects questions the way others collect quotations.</p>" +
        "<p>When a sentence resists you, that resistance is information. Do not rush to resolve it. Ask it aloud, write it in the margin, and let it travel with you into the next chapter, where the book may answer it without meaning to.</p>" +
        "<p>The strange thing about a kept question is how it changes what you notice. Once you are genuinely curious whether the author is right, every example becomes evidence and every aside a clue. The book stops washing over you and starts arguing back.</p>" +
        "<p>So when something here puzzles you, resist the urge to move on. Select it, and hold it up to the light. The question you keep today is the understanding you earn tomorrow.</p>",
    },
    {
      id: "ch3",
      title: "III. The Lamplighter's Question",
      bodyHtml:
        "<h1>III. The Lamplighter's Question</h1>" +
        "<p>In a town that had forgotten the stars, there lived a lamplighter who climbed the same hill every dusk to light a single lamp. No one had asked him to. The lamp lit nothing but a bend in an empty road.</p>" +
        "<p>One evening a child followed him up and asked why he bothered, since no traveler ever came. The lamplighter thought for a long moment. “I light it,” he said, “so that if someone comes, the dark will not have the last word.”</p>" +
        "<p>The child returned the next night, and the next, until lighting the lamp became something the two of them did together. In time others climbed the hill as well, not because the road had changed, but because a small, stubborn light had given them a reason to look up.</p>" +
        "<p>Years later the town remembered the lamp long after it remembered the darkness. That is the strange arithmetic of small, faithful acts: they are easy to dismiss while they happen, and impossible to forget once they are done.</p>",
    },
  ],
};

const VI: SampleContent = {
  identifier: "urn:uuid:marginalia-sample-vi",
  bookTitle: "Bên lề · Sách đọc thử",
  lang: "vi",
  navTitle: "Mục lục",
  chapters: [
    {
      id: "ch1",
      title: "I. Đọc bên lề trang sách",
      bodyHtml:
        "<h1>I. Đọc bên lề trang sách</h1>" +
        "<p>Khoảnh khắc cô độc mà cũng tự do nhất khi đọc thường không nằm trong phần nội dung chính, mà ở khoảng trắng hẹp bên lề. Ở đó không có tiếng nói của tác giả, chỉ có thắc mắc, phản biện và những liên tưởng bất chợt của bạn. Hãy ghi chúng lại để cuốn sách thực sự trở thành của bạn.</p>" +
        "<p>Lề sách không phải chỗ thứ yếu. Nhiều ý tưởng lớn ban đầu chỉ là câu hỏi một độc giả viết vội ở cuối trang: “Điều này có thật không?” Nghi ngờ không phải bất kính với tác giả, mà là cách đọc trung thực nhất.</p>" +
        "<p>Bạn có thể thử ngay: chọn một câu khiến bạn chưa chắc chắn, rồi hỏi nó dựa trên giả định nào và bỏ qua điều gì. Một câu hỏi nhỏ đôi khi mở ra ý nghĩa của cả trang sách.</p>" +
        "<p>Một lời ghi chú hay không chỉ nhắc lại nội dung. Nó giống như một phát hiện: bạn chợt nhận ra hai ý tưởng xa nhau lại có điểm chung, hoặc một khẳng định chắc nịch đang dựa vào bước nhảy chưa ai chất vấn. Hãy cầm sẵn cây bút. Phát hiện tiếp theo có thể chỉ cách một câu.</p>",
    },
    {
      id: "ch2",
      title: "II. Câu hỏi đáng giữ lại",
      bodyHtml:
        "<h1>II. Câu hỏi đáng giữ lại</h1>" +
        "<p>Không phải câu hỏi nào cũng cần được trả lời ngay. Có câu đáng giữ lại, mang theo từ trang này sang trang khác, nghĩ đi nghĩ lại trong đêm để nó dần sáng tỏ. Người đọc tốt sưu tầm câu hỏi như người khác sưu tầm danh ngôn.</p>" +
        "<p>Khi một câu văn khiến bạn khựng lại, chính sự ngập ngừng ấy đã cho bạn một manh mối. Đừng vội gạt nó đi. Hãy đọc thành tiếng, ghi bên lề và mang theo sang chương tiếp theo. Có thể cuốn sách sẽ vô tình trả lời bạn.</p>" +
        "<p>Điều lạ nhất ở một câu hỏi được giữ lại là nó làm thay đổi những gì bạn chú ý. Khi thật sự muốn biết tác giả có đúng không, mỗi ví dụ đều thành bằng chứng và mỗi đoạn chen vào đều thành manh mối. Cuốn sách không còn lướt qua bạn, mà bắt đầu tranh luận với bạn.</p>" +
        "<p>Vì vậy, nếu có điều gì khiến bạn băn khoăn, đừng vội lật qua. Hãy chọn đoạn đó và nhìn kỹ dưới ánh sáng. Câu hỏi bạn giữ lại hôm nay có thể trở thành hiểu biết bạn có được ngày mai.</p>",
    },
    {
      id: "ch3",
      title: "III. Câu hỏi của người thắp đèn",
      bodyHtml:
        "<h1>III. Câu hỏi của người thắp đèn</h1>" +
        "<p>Ở một thị trấn đã quên mất những vì sao, có một người thắp đèn. Mỗi buổi chạng vạng, ông đều leo lên cùng một ngọn đồi để thắp một ngọn đèn. Không ai nhờ ông làm vậy. Ngọn đèn chỉ soi sáng khúc quanh trên con đường vắng.</p>" +
        "<p>Một chiều nọ, một đứa trẻ theo ông lên đồi và hỏi tại sao ông phải làm thế khi chẳng có lữ khách nào đi qua. Người thắp đèn suy nghĩ hồi lâu rồi đáp: “Tôi thắp đèn để nếu có ai đến, bóng tối không phải là lời cuối cùng.”</p>" +
        "<p>Đứa trẻ quay lại vào tối hôm sau, rồi mỗi tối tiếp theo, cho đến khi hai người cùng thắp đèn. Dần dần, những người khác cũng lên đồi. Con đường chẳng đổi khác, nhưng ánh sáng nhỏ bé và bền bỉ ấy đã cho họ lý do để ngẩng đầu nhìn lên.</p>" +
        "<p>Nhiều năm sau, thị trấn nhớ ngọn đèn lâu hơn nhớ bóng tối. Đó là phép tính kỳ lạ của những việc nhỏ được làm đến nơi đến chốn: khi đang diễn ra, chúng dễ bị xem nhẹ; khi đã hoàn thành, người ta khó lòng quên được.</p>",
    },
  ],
};

function contentFor(language: UILanguage): SampleContent {
  switch (language) {
    case "vi":
      return VI;
    case "en":
      return EN;
    default:
      return EN;
  }
}

/** Tạo bytes EPUB3 mẫu hợp lệ theo mã ngôn ngữ, không cần tài nguyên ngoài. */
export function buildSampleEpub(language: UILanguage): Uint8Array {
  const c = contentFor(language);

  const container =
    '<?xml version="1.0"?>\n' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
    '  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n' +
    "</container>";

  const manifestItems = c.chapters
    .map((ch) => `<item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spineItems = c.chapters.map((ch) => `<itemref idref="${ch.id}"/>`).join("\n    ");

  const opf =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">\n' +
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
    `    <dc:identifier id="bookid">${c.identifier}</dc:identifier>\n` +
    `    <dc:title>${c.bookTitle}</dc:title>\n` +
    "    <dc:creator>Read-Anything</dc:creator>\n" +
    `    <dc:language>${c.lang}</dc:language>\n` +
    "  </metadata>\n" +
    "  <manifest>\n" +
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n' +
    `    ${manifestItems}\n` +
    "  </manifest>\n" +
    "  <spine>\n" +
    `    ${spineItems}\n` +
    "  </spine>\n" +
    "</package>";

  const navList = c.chapters
    .map((ch) => `<li><a href="${ch.id}.xhtml">${ch.title}</a></li>`)
    .join("\n    ");
  const nav =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
    `  <head><title>${c.navTitle}</title></head>\n` +
    `  <body><nav epub:type="toc"><ol>\n    ${navList}\n  </ol></nav></body>\n` +
    "</html>";

  const chapterFiles: Zippable = {};
  for (const ch of c.chapters) {
    const xhtml =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${ch.title}</title></head><body>${ch.bodyHtml}</body></html>`;
    chapterFiles[`OEBPS/${ch.id}.xhtml`] = strToU8(xhtml);
  }

  return zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(container),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/nav.xhtml": strToU8(nav),
    ...chapterFiles,
  });
}
