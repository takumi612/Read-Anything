/**
 * Nút trong cây mục lục ePub.
 * `label` and `href` are non-empty (parser-filtered); `href` is an intra-archive path.
 */
export interface TocNode {
  label: string;
  href: string;
  /** #fragment trong chương (ví dụ "filepos0000044175"); chỉ có khi mục TOC có anchor. */
  anchor?: string;
  children?: TocNode[];
}

/** Mục spine: id là manifest item id duy nhất trong sách; href là đường dẫn tuyệt đối trong gói. */
export interface SpineItem {
  id: string;
  href: string;
}

/** Kết quả của parseEpub. */
export interface ParsedEpub {
  uid: string | null; // dc:identifier；null = no dc:identifier, consumer falls back to a content hash
  title?: string;
  author?: string;
  cover?: Uint8Array;
  spine: SpineItem[];
  toc: TocNode[];
}
