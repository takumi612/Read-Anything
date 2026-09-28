// src/main/ai/send.ts
import { type ModelMessage } from "ai";
import { eq } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { conversations } from "@main/db/schema";
import { assemblePrompt, formatCurrentDateTime, pdfSystemNote, textOfParts } from "@main/ai/prompt";
import { buildSystemPrompt } from "@main/ai/base-prompt";
import { dedupeParagraph, toContextChips } from "@main/ai/chips";
import { type LoadBytes } from "@main/ai/tools";
import { supportsImageToolResults } from "@main/ai/model-factory";
import { getBook } from "@main/library/repository";
import type { ResolvedModel } from "@main/ai/assistant-model";
import type { RunBackground } from "@main/ai/background-limiter";
import type { WebSearchConfig } from "@shared/web-search";
import {
  appendMessage,
  getMessage,
  getLastParagraphContent,
  listMessagesAfterSeq,
  resetUserTurnForResend,
} from "@main/chat/messages";
import { t } from "@main/i18n";
import { type ResendInput, type SendInput } from "@shared/chat";
import type { AppNotification } from "@shared/chat";
import { streamAssistantReply, type OkSendResult } from "@main/ai/stream-assistant";
import { formatPdfEvidence, retrievePdfEvidence } from "@main/ai/pdf-retrieval";
import { createLogger } from "@main/logger";
export type { SendInput };

const log = createLogger("pdf-retrieval");

async function pdfEvidenceForTurn(
  deps: SendDeps,
  bookId: string | null,
  chips: ReadonlyArray<{ id: string; content: string }>,
  question: string,
  currentPage?: number,
): Promise<string | null> {
  if (!bookId) return null;
  const book = getBook(deps.db, bookId);
  if (book?.format !== "pdf" || !book.hasTextLayer) return null;
  try {
    const selection = chips.find((chip) => chip.id === "selection")?.content ?? "";
    return formatPdfEvidence(
      await retrievePdfEvidence(bookId, deps.loadBytes, selection, question, currentPage),
    );
  } catch (err) {
    log.warn("could not retrieve PDF excerpts", err);
    return null;
  }
}

export interface SendDeps {
  db: DB;
  loadBytes: LoadBytes;
  resolveModel: () => ResolvedModel;
  /** Chọn model nền cho đặt tên/tóm tắt; nếu chưa cấu hình thì bỏ qua, không tự dùng model chat. */
  resolveSummaryModel: () => ResolvedModel;
  /** Giới hạn tác vụ AI nền dùng chung cho đặt tên, nén ngữ cảnh và tóm tắt. */
  runBackground: RunBackground;
  /** Số bước AI tối đa; 0 nghĩa là không giới hạn và chỉ dừng khi model kết thúc hoặc bị hủy. */
  stepLimit?: number;
  /** Factory tìm kiếm mạng có thể thay bằng mock; chưa cấu hình thì không thêm công cụ. */
  createSearchTools?: (
    cfg: WebSearchConfig,
    turnEnabled: boolean,
  ) => {
    tools: Record<string, unknown>;
    close: () => Promise<unknown>;
  };
  /** Snapshot cấu hình tìm kiếm mạng hiện tại. */
  webSearchConfig?: WebSearchConfig;
  /** Thông báo từ main sang renderer khi tác vụ bộ nhớ nền hoàn tất. */
  notify: (n: AppNotification) => void;
}

export type SendResult = OkSendResult | { ok: false; reason: string };

/** Điều phối gửi đoạn đã chọn tới AI (thiết kế §9). */
export async function runSend(
  deps: SendDeps,
  input: SendInput,
  opts?: { abortSignal?: AbortSignal },
): Promise<SendResult> {
  const { db, resolveModel } = deps;

  // 1. Chọn model trước; nếu thiếu thì báo lỗi và không ghi DB.
  const resolved = resolveModel();
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  // 1b. Kiểm tra hội thoại thuộc sách này; không tự tạo hội thoại mới.
  const convo = db
    .select({
      bookId: conversations.bookId,
      contextSummary: conversations.contextSummary,
      summarizedThroughSeq: conversations.summarizedThroughSeq,
    })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .get();
  if (!convo || convo.bookId !== input.bookId) {
    return { ok: false, reason: t("errors.conversationNotFound", "Không tìm thấy cuộc trò chuyện hoặc cuộc trò chuyện thuộc sách khác") };
  }
  const conversationId = input.conversationId;

  // 2. Lọc chip đã tắt và bỏ đoạn văn trùng, dù renderer thường đã làm.
  const activeChips = input.chips.filter((c) => c.state !== "off");
  const deduped = dedupeParagraph(activeChips, getLastParagraphContent(db, conversationId));
  const pdfEvidence = await pdfEvidenceForTurn(
    deps,
    input.bookId,
    deduped,
    input.userText,
    input.readingContext?.format === "pdf" ? input.readingContext.page : undefined,
  );

  // 3. Lấy lịch sử sau mốc S, hoặc toàn bộ nếu S=null, trước khi lưu lượt mới.
  const history = listMessagesAfterSeq(db, conversationId, convo.summarizedThroughSeq);

  // 4. Lưu tin nhắn người dùng kèm snapshot chip trong metadata.
  appendMessage(db, {
    conversationId,
    role: "user",
    parts: [{ type: "text", text: input.userText }],
    metadata: { contextChips: toContextChips(deduped), model: resolved.modelId },
  });

  // 5. Ghép prompt từ mẫu gốc, instructions, SOUL, chỉ mục bộ nhớ và ghi chú PDF.
  const book = input.bookId ? getBook(db, input.bookId) : undefined;
  const imageToolResults = supportsImageToolResults(resolved.providerType);
  let systemPromptText = buildSystemPrompt(db, conversationId, input.bookId ? "book" : "library");
  if (book?.format === "pdf") {
    const note = pdfSystemNote({
      pageCount: book.pageCount,
      hasTextLayer: Boolean(book.hasTextLayer),
      imageMode: imageToolResults,
    });
    systemPromptText = `${systemPromptText}\n\n${note}`;
  }
  const cfg = deps.webSearchConfig;
  const searchRegistered = Boolean(cfg?.backends.length);
  const webSearchTurn = input.webSearch ?? false;
  const webSearchEnabled = searchRegistered ? webSearchTurn : undefined;

  const allMessages: ModelMessage[] = await assemblePrompt({
    systemPrompt: systemPromptText,
    priorSummary: convo.contextSummary,
    history,
    current: {
      chips: deduped,
      userText: input.userText,
      readingContext: input.readingContext,
      pdfEvidence,
      currentDateTime: formatCurrentDateTime(Temporal.Now.zonedDateTimeISO()),
      webSearchEnabled,
    },
  });

  // Đưa system prompt qua tham số instructions của streamText để tránh cảnh báo.
  let systemPrompt: string | undefined;
  let messages: ModelMessage[];
  if (allMessages.length > 0 && allMessages[0].role === "system") {
    const sysMsg = allMessages[0];
    systemPrompt = typeof sysMsg.content === "string" ? sysMsg.content : undefined;
    messages = allMessages.slice(1);
  } else {
    messages = allMessages;
  }

  // 6. Trả lời dạng stream qua phần xử lý chung.
  return streamAssistantReply(
    deps,
    { conversationId, bookId: input.bookId, resolved, userText: input.userText, webSearchTurn },
    messages,
    systemPrompt,
    opts,
  );
}

/** Gửi lại sau khi sửa hoặc giữ nguyên tin: cắt các lượt sau, dựng lại prompt rồi stream. */
export async function runResend(
  deps: SendDeps,
  input: ResendInput,
  opts?: { abortSignal?: AbortSignal },
): Promise<SendResult> {
  const { db, resolveModel } = deps;

  const resolved = resolveModel();
  if (!resolved.ok) return { ok: false, reason: resolved.reason };

  const convo = db
    .select({
      bookId: conversations.bookId,
      contextSummary: conversations.contextSummary,
      summarizedThroughSeq: conversations.summarizedThroughSeq,
    })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .get();
  if (!convo) {
    return { ok: false, reason: t("errors.conversationNotFound", "Không tìm thấy cuộc trò chuyện hoặc cuộc trò chuyện thuộc sách khác") };
  }

  const target = getMessage(db, input.userMessageId);
  if (!target || target.conversationId !== input.conversationId || target.role !== "user") {
    return { ok: false, reason: t("errors.messageNotResendable", "Không thể gửi lại tin nhắn này") };
  }

  // Transaction: lưu văn bản mới, cắt lịch sử phía sau và đặt lại tóm tắt khi cần.
  resetUserTurnForResend(db, input.conversationId, input.userMessageId, input.userText);

  // Đọc lại trạng thái tóm tắt sau transaction.
  const c2 = db
    .select({
      contextSummary: conversations.contextSummary,
      summarizedThroughSeq: conversations.summarizedThroughSeq,
    })
    .from(conversations)
    .where(eq(conversations.id, input.conversationId))
    .get();

  // Lịch sử trong cửa sổ ngữ cảnh, kết thúc ở lượt người dùng cần gửi lại.
  const window = listMessagesAfterSeq(db, input.conversationId, c2?.summarizedThroughSeq ?? null);
  const current = window.at(-1);
  if (!current) {
    return { ok: false, reason: t("errors.messageNotResendable", "Không thể gửi lại tin nhắn này") };
  }
  const history = window.slice(0, -1);
  const currentText = textOfParts(current.parts);
  const pdfEvidence = await pdfEvidenceForTurn(
    deps,
    convo.bookId,
    current.metadata?.contextChips ?? [],
    currentText,
  );

  // System prompt dùng cùng năm lớp ngữ cảnh và ghi chú PDF như runSend.
  const book = convo.bookId ? getBook(db, convo.bookId) : undefined;
  const imageToolResults = supportsImageToolResults(resolved.providerType);
  let systemPromptText = buildSystemPrompt(
    db,
    input.conversationId,
    convo.bookId ? "book" : "library",
  );
  if (book?.format === "pdf") {
    const note = pdfSystemNote({
      pageCount: book.pageCount,
      hasTextLayer: Boolean(book.hasTextLayer),
      imageMode: imageToolResults,
    });
    systemPromptText = `${systemPromptText}\n\n${note}`;
  }

  const cfg = deps.webSearchConfig;
  const searchRegistered = Boolean(cfg?.backends.length);
  const webSearchTurn = input.webSearch ?? false;
  const webSearchEnabled = searchRegistered ? webSearchTurn : undefined;

  const allMessages: ModelMessage[] = await assemblePrompt({
    systemPrompt: systemPromptText,
    priorSummary: c2?.contextSummary ?? null,
    history,
    current: {
      chips: current.metadata?.contextChips ?? [],
      userText: currentText,
      readingContext: null,
      pdfEvidence,
      currentDateTime: formatCurrentDateTime(Temporal.Now.zonedDateTimeISO()),
      webSearchEnabled,
    },
  });

  let systemPrompt: string | undefined;
  let messages: ModelMessage[];
  if (allMessages.length > 0 && allMessages[0].role === "system") {
    const sysMsg = allMessages[0];
    systemPrompt = typeof sysMsg.content === "string" ? sysMsg.content : undefined;
    messages = allMessages.slice(1);
  } else {
    messages = allMessages;
  }

  return streamAssistantReply(
    deps,
    {
      conversationId: input.conversationId,
      bookId: convo.bookId,
      resolved,
      userText: input.userText,
      webSearchTurn,
    },
    messages,
    systemPrompt,
    opts,
  );
}
