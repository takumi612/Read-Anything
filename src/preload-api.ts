import type { z } from "zod";
import { C, type Contract } from "@shared/ipc";
import type { AiStreamEvent, AppNotification } from "@shared/chat";
import type { PreferencesSnapshot } from "@shared/preferences";

/** Tạo hàm gọi có kiểu từ invoke được tiêm vào; kiểu dữ liệu lấy từ contract. __channel được thu thập để kiểm tra độ lệch. */
export function invoker<S extends z.ZodType, O>(
  invoke: (channel: string, input: unknown) => Promise<unknown>,
  contract: Contract<S, O>,
): ((input: z.infer<S>) => Promise<O>) & { __channel: string } {
  const fn = (input: z.infer<S>) => invoke(contract.channel, input) as Promise<O>;
  return Object.assign(fn, { __channel: contract.channel });
}

/** Các dependency được tiêm vào createApi: tập trung mọi điểm chạm Electron để createApi có thể được kiểm thử độc lập giao diện. */
export interface PreloadDeps {
  invoke: (channel: string, input: unknown) => Promise<unknown>;
  sendSync?: (channel: string, input: unknown) => unknown;
  /** Theo dõi một channel; cb nhận payload đã bỏ IpcRendererEvent và trả về hàm hủy đăng ký. */
  on: (channel: string, cb: (payload: unknown) => void) => () => void;
  onOpenFile: (cb: (filePath: string) => void) => () => void;
  getPathForFile: (file: File) => string;
  prefsSnapshot: PreferencesSnapshot;
  appLocale: string;
}

/** Tạo window.api với cấu trúc tương thích bản trước. Đây là hàm thuần, dependency được tiêm qua deps. */
export function createApi(d: PreloadDeps) {
  const inv = <S extends z.ZodType, O>(c: Contract<S, O>) => invoker(d.invoke, c);
  return {
    app: {
      getInfo: inv(C.appGetInfo),
      pdfAssociationStatus: inv(C.appPdfAssociationStatus),
      resetBackground: inv(C.appResetBackground),
      setBackgroundImage: inv(C.appSetBackground),
      /** Ngôn ngữ hệ thống, được chụp đồng bộ lúc khởi động để i18n chọn ngôn ngữ mặc định. */
      locale: d.appLocale,
      openLogsDir: inv(C.appOpenLogsDir),
      openExternal: inv(C.appOpenExternal),
      checkUpdate: inv(C.appCheckUpdate),
      /** Theo dõi thông báo từ main đến renderer; trả về hàm hủy đăng ký. */
      onNotify: (cb: (n: AppNotification) => void): (() => void) =>
        d.on(C.appNotify.channel, (payload) => cb(payload as AppNotification)),
      onOpenFile: d.onOpenFile,
    },
    log: {
      write: inv(C.logWrite),
    },
    ping: inv(C.ping),

    library: {
      import: inv(C.libraryImport),
      pickBook: inv(C.libraryPickBook),
      list: inv(C.libraryList),
      get: inv(C.libraryGet),
      readBookBytes: inv(C.libraryReadBookBytes),
      exportAnnotatedPdf: inv(C.libraryExportAnnotatedPdf),
      relink: inv(C.libraryRelink),
      delete: inv(C.libraryDelete),
      clearPdfData: inv(C.libraryClearPdfData),
      clearBookCategory: inv(C.readerClearBookCategory),
      update: inv(C.libraryUpdate),
      recentlyRead: inv(C.libraryRecentlyRead),
      reorder: inv(C.libraryReorder),
      bookmarks: {
        list: inv(C.pdfBookmarksList),
        create: inv(C.pdfBookmarksCreate),
        rename: inv(C.pdfBookmarksRename),
        delete: inv(C.pdfBookmarksDelete),
      },
      /** Lấy đường dẫn đĩa từ File được kéo vào. Electron 41 đã bỏ File.path nên cần dùng webUtils. Đồng bộ, chỉ chạy ở renderer, không qua IPC. */
      pathForFile: (file: File) => d.getPathForFile(file),
    },

    progress: {
      get: inv(C.progressGet),
      save: inv(C.progressSave),
      saveSync: (input: z.infer<typeof C.progressSaveSync.input>): boolean =>
        d.sendSync?.(C.progressSaveSync.channel, input) === true,
    },

    readingSessions: {
      start: inv(C.readingSessionsStart),
      complete: inv(C.readingSessionsComplete),
      list: inv(C.readingSessionsList),
      get: inv(C.readingSessionsGet),
      generateReport: inv(C.readingSessionsGenerateReport),
      cancelReport: inv(C.readingSessionsCancelReport),
      saveReport: inv(C.readingSessionsSaveReport),
    },

    content: {
      toc: inv(C.contentToc),
      chapters: inv(C.contentChapters),
      chapterText: inv(C.contentChapterText),
      chapterSummary: inv(C.contentChapterSummary),
      generateChapterSummary: inv(C.contentGenerateChapterSummary),
      bookSummary: inv(C.contentBookSummary),
      generateBookSummary: inv(C.contentGenerateBookSummary),
    },

    annotations: {
      listByBook: inv(C.annotationsListByBook),
      create: inv(C.annotationsCreate),
      update: inv(C.annotationsUpdate),
      delete: inv(C.annotationsDelete),
    },

    vocabulary: {
      list: inv(C.vocabularyList),
      countOccurrences: inv(C.vocabularyCountOccurrences),
      lookup: inv(C.vocabularyLookup),
      savePhrase: inv(C.vocabularySavePhrase),
      update: inv(C.vocabularyUpdate),
      delete: inv(C.vocabularyDelete),
      refresh: inv(C.vocabularyRefresh),
      setOccurrence: inv(C.vocabularySetOccurrence),
    },

    bookNotes: {
      listByBook: inv(C.bookNotesListByBook),
      create: inv(C.bookNotesCreate),
      update: inv(C.bookNotesUpdate),
      delete: inv(C.bookNotesDelete),
    },

    preferences: {
      // Đọc đồng bộ từ prefsSnapshot đã lấy một lần lúc khởi động; ghi vẫn bất đồng bộ fire-and-forget. Sự khác nhau này là có chủ đích.
      // Giá trị trả về là **ảnh chụp lúc khởi động**, không phản ánh các lần set() khi ứng dụng đang chạy. Chỉ hydrate và theme-store gọi lúc khởi tạo;
      // trạng thái hiện tại được các store giữ trong bộ nhớ. Không gọi getAll() lặp lại để đọc giá trị mới nhất khi đang chạy.
      getAll: () => d.prefsSnapshot,
      set: inv(C.preferencesSet),
    },

    settings: {
      providers: {
        list: inv(C.providersList),
        upsert: inv(C.providersUpsert),
        reveal: inv(C.providersReveal),
        test: inv(C.providersTest),
        remove: inv(C.providersRemove),
        listModels: inv(C.providersListModels),
      },
    },

    chat: {
      conversations: {
        listByBook: inv(C.conversationsListByBook),
        create: inv(C.conversationsCreate),
        delete: inv(C.conversationsDelete),
      },
      messages: {
        listByConversation: inv(C.messagesListByConversation),
      },
    },

    ai: {
      buildChips: inv(C.aiBuildChips),
      translateSelection: inv(C.aiTranslateSelection),
      send: inv(C.aiSend),
      resend: inv(C.aiResend),
      abort: inv(C.aiAbort),
      /** Theo dõi dữ liệu tăng dần của streamId này; trả về hàm hủy đăng ký. */
      onChunk: (streamId: string, cb: (ev: AiStreamEvent) => void): (() => void) =>
        d.on(C.aiChunk.channel, (payload) => {
          const ev = payload as AiStreamEvent;
          if (ev.streamId === streamId) cb(ev);
        }),
    },

    stats: {
      readingState: inv(C.statsReadingState),
      get: inv(C.statsGet),
      getPageStreak: inv(C.statsPageStreakGet),
      recordPageRead: inv(C.statsRecordPageRead),
    },

    backup: {
      /** Xuất bản sao lưu cần chỉ rõ kind; tiến trình chính mở saveDialog và trả về null nếu người dùng hủy. */
      export: inv(C.backupExport),
      /** Chọn và kiểm tra gói sao lưu; tiến trình chính mở openDialog, trả về null nếu hủy và kèm kết luận tương thích cho hộp thoại xác nhận. */
      inspect: inv(C.backupInspect),
      /** Khôi phục bằng cách thay thế toàn bộ dữ liệu, được ràng buộc với archiveSha256 từ bước kiểm tra; tiến trình chính khởi động lại sau khi thành công. */
      restore: inv(C.backupRestore),
    },

    memories: {
      list: inv(C.memoriesList),
      update: inv(C.memoriesUpdate),
      delete: inv(C.memoriesDelete),
    },

    agent: {
      resetAvatar: inv(C.agentResetAvatar),
      setAvatar: inv(C.agentSetAvatar),
    },
  };
}

export type RendererApi = ReturnType<typeof createApi>;
