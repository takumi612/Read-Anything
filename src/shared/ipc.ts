import { z } from "zod";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import type { ApplicationBackgroundPickResult } from "@shared/app-background";
import type { PdfBookmarkDto } from "@shared/pdf-bookmarks";
import {
  createPdfBookmarkInput,
  deletePdfBookmarkInput,
  renamePdfBookmarkInput,
} from "@shared/pdf-bookmarks";
import {
  vocabularyDeleteInput,
  vocabularyLookupInput,
  vocabularySavePhraseInput,
  vocabularyOccurrenceInput,
  vocabularyUpdateInput,
} from "@shared/vocabulary";
import type { TocNode } from "@shared/types";
import type {
  BookSummaryContentDto,
  BookSummaryDto,
  ChapterRefDto,
  ChapterSummaryDto,
  ChapterTextSlice,
  ExportAnnotatedPdfResult,
  ProgressDto,
  ReadBookBytesResult,
  RecentlyReadDto,
  RelinkResult,
} from "@shared/library";
import {
  bookIdInput,
  chapterRefInput,
  clearBookCategoryInput,
  exportAnnotatedPdfInput,
  generateChapterSummaryInput,
  importBookInput,
  readChapterTextInput,
  reorderBooksInput,
  saveProgressInput,
  updateBookInput,
} from "@shared/library";
import type { ListModelsResult, ProviderDto, RevealResult, TestResult } from "@shared/providers";
import {
  listModelsInput,
  providerIdInput,
  testProviderInput,
  upsertProviderInput,
} from "@shared/providers";
import type {
  AiStreamEvent,
  AppNotification,
  Chip,
  ConversationDto,
  MessagesByConversationOutput,
  SendAck,
  TranslateSelectionResult,
} from "@shared/chat";
import {
  abortInput,
  buildChipsInput,
  conversationIdInput,
  createConversationInput,
  listConversationsInput,
  messagesByConversationInput,
  resendRequest,
  sendRequest,
  translateSelectionInput,
} from "@shared/chat";
import type { AnnotationDto } from "@shared/annotations";
import {
  annotationIdInput,
  createAnnotationInput,
  updateAnnotationInput,
} from "@shared/annotations";
import type { BookNoteDto } from "@shared/book-notes";
import { bookNoteIdInput, createBookNoteInput, updateBookNoteInput } from "@shared/book-notes";
import type { PreferencesSnapshot } from "@shared/preferences";
import { setPreferenceInput } from "@shared/preferences";
import type { PageStreakDto, ReadingStatsDto, RecordPageReadResultDto } from "@shared/stats";
import { recordPageReadInput, statsGetInput, statsReadingStateInput } from "@shared/stats";
import type { BackupExportResult, BackupInspection } from "@shared/backup";
import { backupExportInput, backupRestoreInput } from "@shared/backup";
import type { MemoryDto } from "@shared/memory";
import { deleteMemoryInput, updateMemoryInput } from "@shared/memory";
import type { AvatarPickResult } from "@shared/agent";
import type {
  CancelReadingReportResult,
  GenerateReadingReportResult,
  ReadingSessionDetailDto,
  ReadingSessionSummaryDto,
} from "@shared/reading-sessions";
import {
  completeReadingInput,
  listReadingSessionsInput,
  readingSessionIdInput,
  saveReadingReportInput,
  startReadingInput,
} from "@shared/reading-sessions";

/** Ping mẫu có đầu vào được Zod kiểm tra. */
export const pingInput = z.object({ msg: z.string().min(1) });

export const openExternalInput = z.object({ url: z.string().min(1) });
export type OpenExternalInput = z.infer<typeof openExternalInput>;

/** log:write ghi log renderer qua IPC vào renderer-*.log.
 * Giới hạn độ dài tại ranh giới IPC để tránh làm đầy log; logger ở main còn cắt thêm
 * theo BODY_MAX cho cả những lời gọi không qua IPC. */
export const logWriteInput = z.object({
  level: z.enum(["error", "warn", "info", "debug"]),
  module: z.string().min(1).max(64),
  message: z.string().max(16_384),
});
export type LogWriteInput = z.infer<typeof logWriteInput>;
export type PingInput = z.infer<typeof pingInput>;
export const pingResult = z.object({ echo: z.string() });
export type PingResult = z.infer<typeof pingResult>;

/** app:get-info không có đầu vào, trả phiên bản và số sách. */
export const appGetInfoResult = z.object({
  version: z.string(),
  bookCount: z.number().int().nonnegative(),
  platform: z.string(),
});
export type AppGetInfoResult = z.infer<typeof appGetInfoResult>;
export interface AppOpenFilePayload {
  filePath: string;
}

/** app:check-update trả trạng thái kiểm tra cập nhật, phân biệt bằng status. */
export const updateCheckResult = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("update-available"),
    currentVersion: z.string(),
    latestVersion: z.string(),
    releaseUrl: z.string(),
  }),
  z.object({
    status: z.literal("up-to-date"),
    currentVersion: z.string(),
    latestVersion: z.string(),
  }),
  z.object({
    status: z.literal("error"),
    currentVersion: z.string(),
    message: z.string(),
  }),
]);
export type UpdateCheckResult = z.infer<typeof updateCheckResult>;

/** Phần tử mang kiểu output, không tạo giá trị lúc chạy; main không kiểm tra output bằng schema. */
declare const OUT: unique symbol;
export interface Out<O> {
  readonly [OUT]: O;
}
export const out = <O>(): Out<O> => ({}) as Out<O>;

export type IpcKind = "invoke" | "sync" | "event";

/** Một hợp đồng IPC gồm channel, loại, Zod schema đầu vào và kiểu đầu ra. */
export interface Contract<S extends z.ZodType = z.ZodType, O = unknown> {
  channel: string;
  kind: IpcKind;
  input: S;
  output: Out<O>;
}

export type ContractMap = Record<string, Contract>;

export type InferIn<C> = C extends Contract<infer S, infer _O> ? z.infer<S> : never;
export type InferOut<C> = C extends Contract<z.ZodType, infer O> ? O : never;

/** Định nghĩa hợp đồng và giữ suy luận kiểu chính xác cho bind/invoker. */
function def<S extends z.ZodType, O>(
  channel: string,
  kind: IpcKind,
  input: S,
  output: Out<O>,
): Contract<S, O> {
  return { channel, kind, input, output };
}

/**
 * Nguồn duy nhất của hợp đồng IPC: thêm hoặc sửa channel tại đây.
 * Input dùng schema từ từng miền; output chỉ dùng để kiểm tra kiểu lúc biên dịch.
 */
export const C = {
  // app / ping
  appGetInfo: def("app:get-info", "invoke", z.void(), out<AppGetInfoResult>()),
  appPdfAssociationStatus: def(
    "app:pdf-association-status",
    "invoke",
    z.void(),
    out<"default" | "other" | "unknown">(),
  ),
  appResetBackground: def("app:reset-background", "invoke", z.void(), out<void>()),
  appSetBackground: def(
    "app:set-background",
    "invoke",
    z.instanceof(Uint8Array),
    out<ApplicationBackgroundPickResult>(),
  ),
  appOpenFile: def("app:open-file", "event", z.void(), out<AppOpenFilePayload>()),
  appGetLocaleSync: def("app:get-locale-sync", "sync", z.void(), out<string>()),
  appOpenExternal: def("app:open-external", "invoke", openExternalInput, out<void>()),
  appCheckUpdate: def("app:check-update", "invoke", z.void(), out<UpdateCheckResult>()),
  ping: def("ping", "invoke", pingInput, out<PingResult>()),

  // library
  libraryImport: def("library:import", "invoke", importBookInput, out<BookSummaryDto>()),
  libraryList: def("library:list", "invoke", z.void(), out<BookSummaryDto[]>()),
  libraryGet: def("library:get", "invoke", bookIdInput, out<BookSummaryDto | null>()),
  libraryPickBook: def("library:pick-book", "invoke", z.void(), out<string | null>()),
  libraryReadBookBytes: def(
    "library:read-book-bytes",
    "invoke",
    bookIdInput,
    out<ReadBookBytesResult>(),
  ),
  libraryExportAnnotatedPdf: def(
    "library:export-annotated-pdf",
    "invoke",
    exportAnnotatedPdfInput,
    out<ExportAnnotatedPdfResult>(),
  ),
  libraryRelink: def("library:relink", "invoke", bookIdInput, out<RelinkResult>()),
  libraryDelete: def("library:delete", "invoke", bookIdInput, out<void>()),
  libraryClearPdfData: def("library:clear-pdf-data", "invoke", bookIdInput, out<string[]>()),
  readerClearBookCategory: def(
    "reader:clear-book-category",
    "invoke",
    clearBookCategoryInput,
    out<number>(),
  ),
  libraryUpdate: def("library:update", "invoke", updateBookInput, out<BookSummaryDto>()),
  libraryRecentlyRead: def("library:recently-read", "invoke", z.void(), out<RecentlyReadDto[]>()),
  libraryReorder: def("library:reorder", "invoke", reorderBooksInput, out<void>()),
  pdfBookmarksList: def("pdf-bookmarks:list", "invoke", bookIdInput, out<PdfBookmarkDto[]>()),
  pdfBookmarksCreate: def(
    "pdf-bookmarks:create",
    "invoke",
    createPdfBookmarkInput,
    out<PdfBookmarkDto>(),
  ),
  pdfBookmarksRename: def(
    "pdf-bookmarks:rename",
    "invoke",
    renamePdfBookmarkInput,
    out<PdfBookmarkDto>(),
  ),
  pdfBookmarksDelete: def("pdf-bookmarks:delete", "invoke", deletePdfBookmarkInput, out<void>()),

  // progress
  progressGet: def(
    "progress:get",
    "invoke",
    bookIdInput,
    out<ProgressDto | null>(),
  ),
  progressSave: def("progress:save", "invoke", saveProgressInput, out<void>()),
  progressSaveSync: def("progress:save-sync", "sync", saveProgressInput, out<boolean>()),

  // reading sessions
  readingSessionsStart: def(
    "reading-sessions:start",
    "invoke",
    startReadingInput,
    out<ReadingSessionSummaryDto>(),
  ),
  readingSessionsComplete: def(
    "reading-sessions:complete",
    "invoke",
    completeReadingInput,
    out<ReadingSessionSummaryDto>(),
  ),
  readingSessionsList: def(
    "reading-sessions:list",
    "invoke",
    listReadingSessionsInput,
    out<ReadingSessionSummaryDto[]>(),
  ),
  readingSessionsGet: def(
    "reading-sessions:get",
    "invoke",
    readingSessionIdInput,
    out<ReadingSessionDetailDto>(),
  ),
  readingSessionsGenerateReport: def(
    "reading-sessions:generate-report",
    "invoke",
    readingSessionIdInput,
    out<GenerateReadingReportResult>(),
  ),
  readingSessionsCancelReport: def(
    "reading-sessions:cancel-report",
    "invoke",
    readingSessionIdInput,
    out<CancelReadingReportResult>(),
  ),
  readingSessionsSaveReport: def(
    "reading-sessions:save-report",
    "invoke",
    saveReadingReportInput,
    out<ReadingSessionDetailDto>(),
  ),

  // content
  contentToc: def("content:toc", "invoke", bookIdInput, out<TocNode[]>()),
  contentChapters: def("content:chapters", "invoke", bookIdInput, out<ChapterRefDto[]>()),
  contentChapterText: def(
    "content:chapter-text",
    "invoke",
    readChapterTextInput,
    out<ChapterTextSlice>(),
  ),
  contentChapterSummary: def(
    "content:chapter-summary",
    "invoke",
    chapterRefInput,
    out<ChapterSummaryDto>(),
  ),
  contentGenerateChapterSummary: def(
    "content:generate-chapter-summary",
    "invoke",
    generateChapterSummaryInput,
    out<ChapterSummaryDto>(),
  ),
  contentBookSummary: def(
    "content:book-summary",
    "invoke",
    bookIdInput,
    out<BookSummaryContentDto>(),
  ),
  contentGenerateBookSummary: def(
    "content:generate-book-summary",
    "invoke",
    bookIdInput,
    out<BookSummaryContentDto>(),
  ),

  // annotations
  annotationsListByBook: def(
    "annotations:list-by-book",
    "invoke",
    bookIdInput,
    out<AnnotationDto[]>(),
  ),
  annotationsCreate: def(
    "annotations:create",
    "invoke",
    createAnnotationInput,
    out<AnnotationDto>(),
  ),
  annotationsUpdate: def(
    "annotations:update",
    "invoke",
    updateAnnotationInput,
    out<AnnotationDto>(),
  ),
  annotationsDelete: def("annotations:delete", "invoke", annotationIdInput, out<void>()),

  vocabularyList: def("vocabulary:list", "invoke", bookIdInput, out<VocabularyEntryDto[]>()),
  vocabularyCountOccurrences: def(
    "vocabulary:count-occurrences",
    "invoke",
    bookIdInput,
    out<Record<string, number>>(),
  ),
  vocabularyLookup: def(
    "vocabulary:lookup",
    "invoke",
    vocabularyLookupInput,
    out<VocabularyEntryDto>(),
  ),
  vocabularySavePhrase: def(
    "vocabulary:save-phrase",
    "invoke",
    vocabularySavePhraseInput,
    out<VocabularyEntryDto>(),
  ),
  vocabularyUpdate: def(
    "vocabulary:update",
    "invoke",
    vocabularyUpdateInput,
    out<VocabularyEntryDto>(),
  ),
  vocabularyDelete: def("vocabulary:delete", "invoke", vocabularyDeleteInput, out<void>()),
  vocabularyRefresh: def(
    "vocabulary:refresh",
    "invoke",
    vocabularyDeleteInput,
    out<VocabularyEntryDto>(),
  ),
  vocabularySetOccurrence: def(
    "vocabulary:set-occurrence",
    "invoke",
    vocabularyOccurrenceInput,
    out<void>(),
  ),

  // Ghi chú cấp sách, độc lập với annotation của đoạn chọn.
  bookNotesListByBook: def("book-notes:list-by-book", "invoke", bookIdInput, out<BookNoteDto[]>()),
  bookNotesCreate: def("book-notes:create", "invoke", createBookNoteInput, out<BookNoteDto>()),
  bookNotesUpdate: def("book-notes:update", "invoke", updateBookNoteInput, out<BookNoteDto>()),
  bookNotesDelete: def("book-notes:delete", "invoke", bookNoteIdInput, out<void>()),

  // settings: providers
  providersList: def("providers:list", "invoke", z.void(), out<ProviderDto[]>()),
  providersUpsert: def("providers:upsert", "invoke", upsertProviderInput, out<ProviderDto>()),
  providersReveal: def("providers:reveal", "invoke", providerIdInput, out<RevealResult>()),
  providersTest: def("providers:test", "invoke", testProviderInput, out<TestResult>()),
  providersRemove: def("providers:remove", "invoke", providerIdInput, out<void>()),
  providersListModels: def(
    "providers:list-models",
    "invoke",
    listModelsInput,
    out<ListModelsResult>(),
  ),

  // Chat; conversationsGet chỉ dùng trong main, preload không công khai.
  conversationsListByBook: def(
    "conversations:list-by-book",
    "invoke",
    listConversationsInput,
    out<ConversationDto[]>(),
  ),
  conversationsCreate: def(
    "conversations:create",
    "invoke",
    createConversationInput,
    out<ConversationDto>(),
  ),
  conversationsGet: def(
    "conversations:get",
    "invoke",
    conversationIdInput,
    out<ConversationDto | null>(),
  ),
  conversationsDelete: def("conversations:delete", "invoke", conversationIdInput, out<void>()),
  messagesListByConversation: def(
    "messages:list-by-conversation",
    "invoke",
    messagesByConversationInput,
    out<MessagesByConversationOutput>(),
  ),

  // ai
  aiBuildChips: def("ai:build-chips", "invoke", buildChipsInput, out<Chip[]>()),
  aiTranslateSelection: def(
    "ai:translate-selection",
    "invoke",
    translateSelectionInput,
    out<TranslateSelectionResult>(),
  ),
  aiSend: def("ai:send", "invoke", sendRequest, out<SendAck>()),
  aiResend: def("ai:resend", "invoke", resendRequest, out<SendAck>()),
  aiAbort: def("ai:abort", "invoke", abortInput, out<void>()),
  aiChunk: def("ai:chunk", "event", z.void(), out<AiStreamEvent>()),
  appNotify: def("app:notify", "event", z.void(), out<AppNotification>()),

  // preferences
  preferencesGetAllSync: def(
    "preferences:get-all-sync",
    "sync",
    z.void(),
    out<PreferencesSnapshot>(),
  ),
  preferencesSet: def("preferences:set", "invoke", setPreferenceInput, out<void>()),

  // Thống kê thời gian đọc.
  statsReadingState: def("stats:reading-state", "invoke", statsReadingStateInput, out<void>()),
  statsGet: def("stats:get", "invoke", statsGetInput, out<ReadingStatsDto>()),
  statsPageStreakGet: def("stats:page-streak-get", "invoke", z.void(), out<PageStreakDto>()),
  statsRecordPageRead: def(
    "stats:record-page-read",
    "invoke",
    recordPageReadInput,
    out<RecordPageReadResultDto>(),
  ),

  // backup
  backupExport: def("backup:export", "invoke", backupExportInput, out<BackupExportResult | null>()),
  backupInspect: def("backup:inspect", "invoke", z.void(), out<BackupInspection | null>()),
  backupRestore: def("backup:restore", "invoke", backupRestoreInput, out<void>()),

  // memories
  memoriesList: def("memories:list", "invoke", z.void(), out<MemoryDto[]>()),
  memoriesUpdate: def("memories:update", "invoke", updateMemoryInput, out<MemoryDto | null>()),
  memoriesDelete: def("memories:delete", "invoke", deleteMemoryInput, out<void>()),

  // logging
  logWrite: def("log:write", "invoke", logWriteInput, out<void>()),
  appOpenLogsDir: def("app:open-logs-dir", "invoke", z.void(), out<void>()),

  // Ảnh đại diện của trợ lý.
  agentResetAvatar: def("agent:reset-avatar", "invoke", z.void(), out<void>()),
  agentSetAvatar: def(
    "agent:set-avatar",
    "invoke",
    z.instanceof(Uint8Array),
    out<AvatarPickResult>(),
  ),
};
