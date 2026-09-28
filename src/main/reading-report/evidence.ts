import { and, asc, desc, eq, gt, gte, lt, lte, or, type SQLWrapper } from "drizzle-orm";
import type { DB } from "@main/db/client";
import { annotations, bookNotes, conversations, messages } from "@main/db/schema";
import type { ReadingSessionRow } from "@main/reading-sessions/repository";
import { textOfParts } from "@main/ai/prompt";
import type { AnnotationDto, AnnotationStyle } from "@shared/annotations";
import type { BookNoteDto } from "@shared/book-notes";
import type { MessageRole, MessageStatus } from "@shared/types";
import { estimateTokens, sliceToTokenBudget } from "@shared/tokens";

export interface SessionConversationSummary {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  /** Số tin nhắn trong phiên đọc để chọn cách xử lý hội thoại. */
  messageCount: number;
  /** Số token ước tính của các tin nhắn trong phiên đọc. */
  estimatedTokens: number;
  /** Hội thoại có bản tóm tắt cuốn chiếu hay không; thường chỉ hội thoại dài mới có. */
  hasCompactedContext: boolean;
}

export interface SessionMessageExcerpt {
  id: string;
  role: MessageRole;
  text: string;
  status: MessageStatus;
  seq: number;
  createdAt: number;
}

export const SESSION_CONVERSATION_DEFAULT_LIMIT = 20;
/**
 * Số tin tối đa tác vụ chính đọc trong một lần để không lấp đầy ngữ cảnh.
 * Tác vụ điều tra một hội thoại có thể dùng maxLimit khác; ngân sách token vẫn kiểm soát kích thước.
 */
export const SESSION_CONVERSATION_MAX_LIMIT = 50;
/**
 * Ngân sách token nội dung cho một lần đọc (xem estimateTokens).
 * Đếm token thay vì ký tự vì mật độ token khác nhau đáng kể giữa các ngôn ngữ.
 */
export const SESSION_CONVERSATION_TOKEN_BUDGET = 24_000;

export interface SessionConversationReadOptions {
  afterSeq?: number;
  limit?: number;
  /** Ghi đè ngân sách token của một lần đọc cho tác vụ điều tra. */
  tokenBudget?: number;
  /** Ghi đè giới hạn số tin; mặc định dùng SESSION_CONVERSATION_MAX_LIMIT. */
  maxLimit?: number;
}

export interface SessionConversationMessage extends SessionMessageExcerpt {
  context: "session" | "neighbor";
  truncated: boolean;
}

export interface SessionConversationReadResult {
  status: "messages";
  /**
   * Bản tóm tắt cuốn chiếu của hội thoại nếu có. Đây chỉ là bối cảnh,
   * có thể chứa trao đổi trước phiên đọc hiện tại nên không dùng làm bằng chứng.
   */
  compactedContext: { summary: string; throughSeq: number } | null;
  messages: SessionConversationMessage[];
  hasMore: boolean;
  nextAfterSeq: number | null;
}

function sessionWindow(session: ReadingSessionRow) {
  if (session.completedAt == null) return null;
  return { startedAt: session.startedAt, completedAt: session.completedAt };
}

function isInWindow(timestamp: SQLWrapper, session: ReadingSessionRow) {
  const window = sessionWindow(session);
  return window && and(gte(timestamp, window.startedAt), lte(timestamp, window.completedAt));
}

function annotationDto(row: typeof annotations.$inferSelect): AnnotationDto {
  return {
    id: row.id,
    bookId: row.bookId,
    style: row.style as AnnotationStyle,
    note: row.note,
    selectedText: row.selectedText,
    locatorRange: row.locatorRange,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function bookNoteDto(row: typeof bookNotes.$inferSelect): BookNoteDto {
  return {
    id: row.id,
    bookId: row.bookId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function messageExcerpt(row: typeof messages.$inferSelect): SessionMessageExcerpt {
  return {
    id: row.id,
    role: row.role as MessageRole,
    text: textOfParts(row.parts),
    status: row.status as MessageStatus,
    seq: row.seq,
    createdAt: row.createdAt,
  };
}

export function listSessionAnnotations(db: DB, session: ReadingSessionRow): AnnotationDto[] {
  const createdInside = isInWindow(annotations.createdAt, session);
  const updatedInside = isInWindow(annotations.updatedAt, session);
  if (!createdInside || !updatedInside) return [];
  return db
    .select()
    .from(annotations)
    .where(and(eq(annotations.bookId, session.bookId), or(createdInside, updatedInside)))
    .orderBy(desc(annotations.createdAt))
    .all()
    .map(annotationDto);
}

export function listSessionBookNotes(db: DB, session: ReadingSessionRow): BookNoteDto[] {
  const createdInside = isInWindow(bookNotes.createdAt, session);
  const updatedInside = isInWindow(bookNotes.updatedAt, session);
  if (!createdInside || !updatedInside) return [];
  return db
    .select()
    .from(bookNotes)
    .where(and(eq(bookNotes.bookId, session.bookId), or(createdInside, updatedInside)))
    .orderBy(desc(bookNotes.createdAt))
    .all()
    .map(bookNoteDto);
}

export function listSessionConversations(
  db: DB,
  session: ReadingSessionRow,
): SessionConversationSummary[] {
  const createdInside = isInWindow(messages.createdAt, session);
  if (!createdInside) return [];
  const rows = db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      contextSummary: conversations.contextSummary,
    })
    .from(conversations)
    .innerJoin(messages, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.bookId, session.bookId), createdInside))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt))
    .all();
  return rows.map(({ contextSummary, ...conversation }) => {
    // Quy mô chỉ tính tin trong phiên đọc để kế hoạch ngân sách khớp vùng có thể đọc.
    const inWindow = db
      .select({ parts: messages.parts })
      .from(messages)
      .where(and(eq(messages.conversationId, conversation.id), createdInside))
      .all();
    return {
      ...conversation,
      messageCount: inWindow.length,
      estimatedTokens: inWindow.reduce(
        (sum, row) => sum + estimateTokens(textOfParts(row.parts)),
        0,
      ),
      hasCompactedContext: Boolean(contextSummary?.trim()),
    };
  });
}

export function readSessionConversation(
  db: DB,
  session: ReadingSessionRow,
  conversationId: string,
  options: SessionConversationReadOptions,
): SessionConversationReadResult {
  const conversation = db
    .select({
      id: conversations.id,
      contextSummary: conversations.contextSummary,
      summarizedThroughSeq: conversations.summarizedThroughSeq,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.bookId, session.bookId)))
    .get();
  if (!conversation) throw new Error("conversation not found for this book");

  const window = sessionWindow(session);
  if (!window) throw new Error("cannot read conversation evidence for an active session");
  const maxLimit = options.maxLimit ?? SESSION_CONVERSATION_MAX_LIMIT;
  const limit = options.limit ?? SESSION_CONVERSATION_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new Error(`conversation page limit must be between 1 and ${maxLimit}`);
  }
  const budget = options.tokenBudget ?? SESSION_CONVERSATION_TOKEN_BUDGET;
  if (!Number.isInteger(budget) || budget < 1) {
    throw new Error("conversation token budget must be a positive integer");
  }
  // Không lọc theo summarizedThroughSeq: nén ngữ cảnh chat không xóa tin gốc.
  // Lọc phần đã nén sẽ làm báo cáo mất bằng chứng cũ. Hội thoại dài hiện được
  // đọc theo trang và giới hạn token ở từng lần gọi.
  const cursor = options.afterSeq ?? -1;
  const rawRows = db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversation.id),
        gt(messages.seq, cursor),
        gte(messages.createdAt, window.startedAt),
        lte(messages.createdAt, window.completedAt),
      ),
    )
    .orderBy(asc(messages.seq))
    .limit(limit + 1)
    .all();

  if (rawRows.length === 0) {
    // Hết cursor thì trả trang rỗng; không có tin nào trong phiên là ID đầu vào sai.
    if (options.afterSeq !== undefined) {
      return {
        status: "messages",
        compactedContext: null,
        messages: [],
        hasMore: false,
        nextAfterSeq: null,
      };
    }
    throw new Error("conversation has no messages during this reading session");
  }

  const hasMore = rawRows.length > limit;
  const pageRows = rawRows.slice(0, limit);
  const first = pageRows[0]!;
  const last = pageRows.at(-1)!;
  const candidates: Array<{
    row: typeof messages.$inferSelect;
    context: SessionConversationMessage["context"];
  }> = [];
  if (options.afterSeq === undefined) {
    const previous = db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversation.id), lt(messages.seq, first.seq)))
      .orderBy(desc(messages.seq))
      .limit(1)
      .get();
    if (previous && estimateTokens(textOfParts(previous.parts)) < budget) {
      candidates.push({ row: previous, context: "neighbor" });
    }
  }
  candidates.push(...pageRows.map((row) => ({ row, context: "session" as const })));
  if (!hasMore) {
    const next = db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversation.id), gt(messages.seq, last.seq)))
      .orderBy(asc(messages.seq))
      .limit(1)
      .get();
    if (next) candidates.push({ row: next, context: "neighbor" });
  }

  let remaining = budget;
  const excerpts: SessionConversationMessage[] = [];
  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const excerpt = messageExcerpt(candidate.row);
    const slice = sliceToTokenBudget(excerpt.text, remaining);
    excerpts.push({
      ...excerpt,
      text: slice.text,
      context: candidate.context,
      truncated: slice.truncated,
    });
    remaining -= slice.tokens;
  }
  const summary = conversation.contextSummary?.trim();
  const compactedContext =
    options.afterSeq === undefined && summary && conversation.summarizedThroughSeq !== null
      ? { summary, throughSeq: conversation.summarizedThroughSeq }
      : null;
  const lastReturnedSessionSeq = excerpts
    .filter((excerpt) => excerpt.context === "session")
    .at(-1)?.seq;
  const budgetOmittedRows =
    lastReturnedSessionSeq !== undefined && lastReturnedSessionSeq < last.seq;
  const pageHasMore = hasMore || budgetOmittedRows;
  return {
    status: "messages",
    compactedContext,
    messages: excerpts,
    hasMore: pageHasMore,
    nextAfterSeq: pageHasMore ? (lastReturnedSessionSeq ?? cursor) : null,
  };
}

export function hasReaderEvidence(db: DB, session: ReadingSessionRow): boolean {
  const annotationCreatedInside = isInWindow(annotations.createdAt, session);
  const annotationUpdatedInside = isInWindow(annotations.updatedAt, session);
  if (!annotationCreatedInside || !annotationUpdatedInside) return false;
  if (
    db
      .select({ id: annotations.id })
      .from(annotations)
      .where(
        and(
          eq(annotations.bookId, session.bookId),
          or(annotationCreatedInside, annotationUpdatedInside),
        ),
      )
      .limit(1)
      .get()
  ) {
    return true;
  }

  const noteCreatedInside = isInWindow(bookNotes.createdAt, session);
  const noteUpdatedInside = isInWindow(bookNotes.updatedAt, session);
  if (
    db
      .select({ id: bookNotes.id })
      .from(bookNotes)
      .where(and(eq(bookNotes.bookId, session.bookId), or(noteCreatedInside!, noteUpdatedInside!)))
      .limit(1)
      .get()
  ) {
    return true;
  }

  const messageCreatedInside = isInWindow(messages.createdAt, session);
  return Boolean(
    messageCreatedInside &&
    db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(conversations.bookId, session.bookId), messageCreatedInside))
      .limit(1)
      .get(),
  );
}
