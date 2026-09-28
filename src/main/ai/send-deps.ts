import { getDb } from "@main/db/instance";
import { appService } from "@main/app";
import { readBookFile } from "@main/library/book-files";
import { getBook } from "@main/library/repository";
import { resolveChatModel, resolveSummaryModel } from "@main/ai/assistant-model";
import { requireAiDataConsent } from "@main/ai/consent";
import { getPreference } from "@main/preferences/repository";
import { Limiter } from "@main/ai/background-limiter";
import { notifyRenderer } from "@main/notify";
import { DEFAULT_BACKGROUND_CONCURRENCY, DEFAULT_STEP_LIMIT } from "@shared/preferences";
import { createSearchTools } from "@main/ai/search/web-search-tool";
import { DEFAULT_WEB_SEARCH } from "@shared/web-search";
import type { DB } from "@main/db/client";
import type { SummaryDeps } from "@main/ai/summary";
import type { LoadBytes } from "@main/ai/tools";
import type { SendDeps } from "@main/ai/send";
import { runReadingReportAgent } from "@main/reading-report/agent";
import { createInvestigator } from "@main/reading-report/investigation-runner";
import { ReadingReportRuntime } from "@main/reading-report/runtime";
import type { ReadingReportServiceDeps } from "@main/reading-report/service";

/** Bộ giới hạn tác vụ nền của tiến trình; đọc preference khi chạy, không truy cập DB lúc import module. */
const backgroundLimiter = new Limiter(
  () => getPreference(getDb(), "backgroundConcurrency") ?? DEFAULT_BACKGROUND_CONCURRENCY,
);

const readingReportRuntime = new ReadingReportRuntime();

/** Đọc bytes bản sao sách theo bookId; thiếu tệp thì ném BookFileMissingError. */
export function createLoadBytes(booksDir: string, db: DB): LoadBytes {
  // Bọc async để lỗi đồng bộ khi thiếu sách cũng thành rejected Promise.
  return async (bookId: string) => {
    const book = getBook(db, bookId);
    if (!book) throw new Error(`send-deps: book ${bookId} not found`);
    return readBookFile(booksDir, bookId, book.format);
  };
}

/** Ghép các dependency thật cho runSend từ singleton phía Electron. */
export function makeSendDeps(): SendDeps {
  const db = getDb();
  const loadBytes = createLoadBytes(appService.getPath("booksDir"), db);
  const resolveModel = () => requireAiDataConsent(db) ?? resolveChatModel(db);
  return {
    db,
    loadBytes,
    resolveModel,
    resolveSummaryModel: () => requireAiDataConsent(db) ?? resolveSummaryModel(db),
    runBackground: backgroundLimiter.run,
    stepLimit: getPreference(db, "stepLimit") ?? DEFAULT_STEP_LIMIT,
    createSearchTools,
    webSearchConfig: getPreference(db, "webSearch") ?? DEFAULT_WEB_SEARCH,
    notify: notifyRenderer,
  };
}

/** Dependency tạo tóm tắt chương; dùng model tóm tắt riêng, không tự dùng model chat. */
export function makeSummaryDeps(): SummaryDeps {
  const db = getDb();
  return {
    db,
    loadBytes: createLoadBytes(appService.getPath("booksDir"), db),
    resolveModel: () => requireAiDataConsent(db) ?? resolveSummaryModel(db),
    runBackground: backgroundLimiter.run,
  };
}

/** Báo cáo đọc dùng một runtime của tiến trình; model nền tách khỏi model chat. */
export function makeReadingReportDeps(): ReadingReportServiceDeps {
  const db = getDb();
  return {
    db,
    loadBytes: createLoadBytes(appService.getPath("booksDir"), db),
    resolveModel: () => requireAiDataConsent(db) ?? resolveSummaryModel(db),
    runBackground: backgroundLimiter.run,
    runAgent: runReadingReportAgent,
    createInvestigator,
    runtime: readingReportRuntime,
    now: () => Temporal.Now.instant(),
  };
}
