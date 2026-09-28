// Không export fixture từ entry chính vì nó phụ thuộc pdf-lib chỉ dùng khi phát triển.
// Bundle của main sẽ gộp toàn bộ cây dependency của entry; pdf-lib có thể lỗi sau khi gộp.
// Kiểm thử import fixture qua đường dẫn phụ @marginalia/pdf-parser/fixture.
export type { ParsedPdf, TocNode, ChapterRange, ChapterTextSlice } from "./types";
export { parsePdf, openPdf, pageText } from "./parse";
export { extractPdfText } from "./content";
export type { PdfReadOptions } from "./content";
export { renderPageImage } from "./render";
export type { RenderOptions } from "./render";
