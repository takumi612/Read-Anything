import {
  blob as blob_,
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { UIMessage } from "ai";
import type { AiProviderApiType } from "@shared/providers";
import type { MessageMetadata, TocNode } from "@shared/types";

const pkUuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());
const nowMs = () =>
  integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now());

export const providers = sqliteTable(
  "providers",
  {
    id: pkUuid(),
    // Định dạng API đang dùng, phải thuộc compatibleApis.
    type: text("type", {
      enum: ["openai-responses", "openai-chat-completions", "anthropic", "google-generate-content"],
    }).notNull(),
    // Các định dạng API hỗ trợ dưới dạng JSON; provider tích hợp có thể đổi type khi có nhiều lựa chọn.
    compatibleApis: text("compatible_apis", { mode: "json" }).$type<AiProviderApiType[]>(),
    label: text("label"),
    baseUrl: text("base_url"),
    apiKey: text("api_key"),
    models: text("models", { mode: "json" }).$type<string[]>(),
    // Provider tích hợp được thêm từ DEFAULT_PROVIDERS: không sửa tên/URL hay xóa.
    isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
    createdAt: nowMs(),
  },
  (t) => [
    check(
      "providers_type_check",
      sql`${t.type} in ('openai-responses','openai-chat-completions','anthropic','google-generate-content')`,
    ),
  ],
);

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(), // ID ổn định: EPUB dùng dc:identifier hoặc hash; PDF dùng hash tệp.
    title: text("title"),
    author: text("author"),
    cover: blob_("cover", { mode: "buffer" }),
    toc: text("toc", { mode: "json" }).$type<TocNode[]>(),
    // Chỉ lưu nội dung tóm tắt sách; trạng thái được suy ra khi chạy.
    // Có summary: ready; đang chạy: generating; lỗi: unavailable; còn lại: pending.
    summary: text("summary"),
    // Định dạng sách quyết định dùng engine PDF hay EPUB.
    format: text("format", { enum: ["epub", "pdf"] })
      .notNull()
      .default("epub"),
    pageCount: integer("page_count"), // Chỉ PDF có số trang; EPUB dùng null.
    // Kết quả phát hiện lớp văn bản khi import; EPUB luôn true. false giới hạn AI/annotation.
    hasTextLayer: integer("has_text_layer", { mode: "boolean" }).notNull().default(true),
    addedAt: integer("added_at")
      .notNull()
      .$defaultFn(() => Date.now()),
    // Vị trí sắp xếp thủ công (#48); listBooks sắp theo position rồi added_at.
    // Kéo thả sẽ ghi lại mọi position. Sách mới lấy MIN(position)-1 để đứng đầu.
    // Nếu trùng position, dùng added_at rồi rowid để phân định; lần kéo thả sau sẽ chuẩn hóa.
    position: integer("position").notNull().default(0),
    // Phiên bản parser; sách cũ sẽ dựng lại chỉ mục khi được mở. null/0 là phiên bản cũ.
    parserVersion: integer("parser_version").notNull().default(0),
  },
  (t) => [check("books_format_check", sql`${t.format} in ('epub','pdf')`)],
);

export const readingSessions = sqliteTable(
  "reading_sessions",
  {
    id: pkUuid(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    report: text("report"),
  },
  (t) => [
    check(
      "reading_sessions_completed_after_start_check",
      sql`${t.completedAt} is null or ${t.completedAt} >= ${t.startedAt}`,
    ),
    check(
      "reading_sessions_report_requires_completion_check",
      sql`${t.report} is null or ${t.completedAt} is not null`,
    ),
    uniqueIndex("reading_sessions_one_active_per_book")
      .on(t.bookId)
      .where(sql`${t.completedAt} is null`),
    index("reading_sessions_book_id_idx").on(t.bookId),
  ],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: pkUuid(), // Khóa UUIDv7 vì spine ID có thể trùng giữa các sách.
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    title: text("title"),
    orderIndex: integer("order_index"),
    href: text("href").notNull(), // Đường dẫn mục spine, định vị duy nhất trong sách.
    anchor: text("anchor"), // #fragment trong chương, null nếu không có.
    startPage: integer("start_page"), // Trang bắt đầu chương PDF, đánh số từ 1; EPUB dùng null.
    endPage: integer("end_page"),
    summary: text("summary"),
  },
  (t) => [unique().on(t.bookId, t.href, t.anchor), index("chapters_book_id_idx").on(t.bookId)],
);

export const progress = sqliteTable(
  "progress",
  {
    bookId: text("book_id")
      .primaryKey()
      .references(() => books.id, { onDelete: "cascade" }),
    locator: text("locator").notNull(),
    // Legacy position estimate retained for existing data; UI progress now uses confirmed reading pages.
    percent: real("percent"),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    check(
      "progress_percent_check",
      sql`${t.percent} is null or (${t.percent} >= 0 and ${t.percent} <= 1)`,
    ),
  ],
);

/** Trang đã đọc tối thiểu năm giây, duy nhất theo sách để tính tiến độ không giảm khi đọc lại. */
export const confirmedReadingPages = sqliteTable(
  "confirmed_reading_pages",
  {
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    confirmedAt: integer("confirmed_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.pageNumber] }),
    check("confirmed_reading_pages_page_positive", sql`${t.pageNumber} >= 1`),
    index("confirmed_reading_pages_book_id_idx").on(t.bookId),
  ],
);

/** Tỉ lệ trang đã xác nhận và mẫu số gần nhất; tách khỏi snapshot locator và chuỗi lửa theo ngày. */
export const confirmedReadingProgress = sqliteTable(
  "confirmed_reading_progress",
  {
    bookId: text("book_id")
      .primaryKey()
      .references(() => books.id, { onDelete: "cascade" }),
    totalPages: integer("total_pages").notNull(),
    percent: real("percent").notNull(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    check("confirmed_reading_progress_total_pages_positive", sql`${t.totalPages} >= 1`),
    check("confirmed_reading_progress_percent_check", sql`${t.percent} >= 0 and ${t.percent} <= 1`),
  ],
);

export const annotations = sqliteTable(
  "annotations",
  {
    id: pkUuid(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    style: text("style").notNull(), // Built-in color, #RRGGBB, or underline.
    note: text("note").notNull().default(""),
    selectedText: text("selected_text").notNull(),
    locatorRange: text("locator_range").notNull(),
    createdAt: nowMs(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    check(
      "annotations_style_check",
      sql`${t.style} in ('yellow','green','blue','pink','purple','underline') or (length(${t.style}) = 7 and substr(${t.style}, 1, 1) = '#' and substr(${t.style}, 2) not glob '*[^0-9a-fA-F]*')`,
    ),
    index("annotations_book_id_idx").on(t.bookId),
  ],
);

/** Per-document vocabulary. Occurrence marks are derived from the PDF text layer. */
export const vocabularyEntries = sqliteTable(
  "vocabulary_entries",
  {
    id: pkUuid(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    normalizedTerm: text("normalized_term").notNull(),
    meaning: text("meaning").notNull(),
    context: text("context").notNull(),
    sourcePage: integer("source_page").notNull(),
    createdAt: nowMs(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    uniqueIndex("vocabulary_book_term_unique").on(t.bookId, t.normalizedTerm),
    index("vocabulary_book_idx").on(t.bookId),
  ],
);

/** A different meaning for one exact text-layer occurrence. */
export const vocabularyOverrides = sqliteTable(
  "vocabulary_overrides",
  {
    entryId: text("entry_id")
      .notNull()
      .references(() => vocabularyEntries.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    meaning: text("meaning").notNull(),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.page, t.start, t.end] })],
);

/** Reader-only PDF bookmarks, independent from the document's own outline. */
export const pdfBookmarks = sqliteTable(
  "pdf_bookmarks",
  {
    id: pkUuid(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    page: integer("page").notNull(),
    scrollRatio: real("scroll_ratio").notNull().default(0),
    createdAt: nowMs(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [index("pdf_bookmarks_book_idx").on(t.bookId)],
);

export const bookNotes = sqliteTable(
  "book_notes",
  {
    id: pkUuid(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    // Nội dung Markdown; schema Zod tại shared/book-notes.ts kiểm tra không rỗng.
    content: text("content").notNull(),
    createdAt: nowMs(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [index("book_notes_book_id_idx").on(t.bookId)],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: pkUuid(),
    // bookId null là hội thoại tại thư viện; khóa ngoại và cascade vẫn áp dụng khi có sách.
    bookId: text("book_id").references(() => books.id, { onDelete: "cascade" }),
    title: text("title"),
    // Quản lý ngữ cảnh: bản tóm tắt cuốn chiếu và seq tin nhắn đã nén.
    // null nghĩa là chưa nén, vẫn giữ nguyên toàn bộ hội thoại.
    contextSummary: text("context_summary"),
    summarizedThroughSeq: integer("summarized_through_seq"),
    memoryThroughSeq: integer("memory_through_seq"),
    createdAt: nowMs(),
    updatedAt: integer("updated_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [index("conversations_book_id_idx").on(t.bookId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: pkUuid(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
    parts: text("parts", { mode: "json" }).$type<UIMessage["parts"]>().notNull(),
    metadata: text("metadata", { mode: "json" }).$type<MessageMetadata>(),
    status: text("status", { enum: ["complete", "error", "aborted"] })
      .notNull()
      .default("complete"),
    seq: integer("seq").notNull(),
    createdAt: nowMs(),
  },
  (t) => [
    check("messages_role_check", sql`${t.role} in ('system','user','assistant')`),
    check("messages_status_check", sql`${t.status} in ('complete','error','aborted')`),
    unique("messages_conversation_seq_unique").on(t.conversationId, t.seq),
    index("messages_conversation_id_idx").on(t.conversationId),
  ],
);

// Bộ nhớ AI toàn cục, không gắn với một sách cụ thể.
// slug là ID phía AI dùng cho công cụ, liên kết [[slug]] và chỉ mục; UUID chỉ dùng nội bộ.
export const memories = sqliteTable("memories", {
  id: pkUuid(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(), // Mô tả ngắn luôn có trong system prompt.
  body: text("body").notNull(), // Nội dung chi tiết; readMemory lấy khi cần, có thể chứa [[slug]].
  createdAt: nowMs(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Bảng liên kết là chỉ mục suy ra từ [[slug]] trong memories.body và có thể dựng lại.
// Không lưu liên kết tới slug không tồn tại; xóa bộ nhớ sẽ xóa các cạnh qua CASCADE.
export const memoryLinks = sqliteTable(
  "memory_links",
  {
    fromId: text("from_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    toId: text("to_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId] }), index("memory_links_to_id_idx").on(t.toId)],
);

// Tùy chọn người dùng: key và JSON value, được service kiểm tra theo schema ở @shared/preferences.
export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

/** Trạng thái nội bộ dạng key-value, tách khỏi tùy chọn người dùng và không gửi sang renderer. */
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now()),
});

// Cộng dồn thời gian đọc theo từng sách và ngày địa phương.
// Xóa sách đặt bookId=null nhưng giữ lịch sử tổng thời gian, biểu đồ ngày và streak.
export const readingDaily = sqliteTable(
  "reading_daily",
  {
    id: pkUuid(),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    readingSessionId: text("reading_session_id").references(() => readingSessions.id, {
      onDelete: "set null",
    }),
    day: text("day").notNull(), // Ngày địa phương dạng YYYY-MM-DD.
    seconds: integer("seconds").notNull().default(0),
  },
  (t) => [
    uniqueIndex("reading_daily_session_day_unique")
      .on(t.readingSessionId, t.day)
      .where(sql`${t.readingSessionId} is not null`),
    index("reading_daily_day_idx").on(t.day),
    index("reading_daily_book_id_idx").on(t.bookId),
    index("reading_daily_session_id_idx").on(t.readingSessionId),
  ],
);

// A page counts once per document and local day, so rereading a page cannot inflate a streak.
export const readingPageVisits = sqliteTable(
  "reading_page_visits",
  {
    id: pkUuid(),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    pageNumber: integer("page_number").notNull(),
    day: text("day").notNull(),
  },
  (t) => [
    check("reading_page_visits_page_positive", sql`${t.pageNumber} >= 1`),
    uniqueIndex("reading_page_visits_book_day_page_unique")
      .on(t.bookId, t.day, t.pageNumber)
      .where(sql`${t.bookId} is not null`),
    index("reading_page_visits_day_idx").on(t.day),
    index("reading_page_visits_book_id_idx").on(t.bookId),
  ],
);

// Kho dữ liệu nhị phân dùng chung; hiện dùng cho ảnh đại diện của trợ lý.
// Bảng nghiệp vụ tham chiếu bằng khóa ngoại thay vì lưu BLOB riêng; xem #83 cho bìa sách.
export const blob = sqliteTable("blob", {
  id: pkUuid(),
  data: blob_("data", { mode: "buffer" }).notNull(),
  mimeType: text("mime_type").notNull(), // Nhận diện từ magic bytes khi ghi, dùng trực tiếp khi đọc.
  createdAt: nowMs(),
});
