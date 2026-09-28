// Tác vụ điều tra hội thoại để tạo báo cáo đọc (spec 2026-08-10).
// Chỉ có logic và các hàm được truyền vào để đọc trang/gọi model; có thể kiểm thử không cần Electron.
import { z } from "zod";
import { parseJsonOutput } from "@main/ai/structured-output";
import { createLogger } from "@main/logger";
import { estimateTokens } from "@shared/tokens";
import {
  type SessionConversationMessage,
  type SessionConversationReadOptions,
  type SessionConversationReadResult,
} from "@main/reading-report/evidence";

const log = createLogger("report");

/** Giới hạn token cho một trang hội thoại; tác vụ này chỉ xử lý một hội thoại. */
export const INVESTIGATION_PAGE_TOKEN_BUDGET = 40_000;
/** Tổng số token tối đa cho một lần điều tra; hết mức thì dừng và báo truncated. */
export const INVESTIGATION_TOTAL_TOKEN_BUDGET = 150_000;
/** Thời gian chờ suất chạy nền trước khi để tác vụ chính tự đọc từng trang. */
export const INVESTIGATION_SLOT_TIMEOUT_MS = 45_000;
/**
 * Số tin nhắn tối đa mỗi trang lớn hơn giới hạn của tác vụ chính.
 * Ngân sách token mới là giới hạn chính; nếu giới hạn số tin nhắn quá thấp,
 * hội thoại gồm nhiều lượt ngắn sẽ bị chia nhỏ, tăng số lần gọi model và mất ngữ cảnh.
 * Vẫn giữ một mức tối đa để tránh đọc quá nhiều tin trong một lần.
 */
export const INVESTIGATION_PAGE_MESSAGE_LIMIT = 500;

const investigationPoint = z.object({
  kind: z.enum(["question", "judgment", "turn", "connection"]),
  text: z.string().min(1),
  quote: z.string().nullable().catch(null),
  seqFrom: z.number().int().nonnegative(),
  seqTo: z.number().int().nonnegative(),
});

export const investigationPageOutput = z.object({
  topic: z.string().min(1),
  points: z.array(investigationPoint),
});

export type InvestigationPoint = z.infer<typeof investigationPoint>;

export interface ConversationInvestigation {
  topic: string;
  points: InvestigationPoint[];
  coverage: {
    fromSeq: number | null;
    toSeq: number | null;
    messagesRead: number;
    /** Chưa bao phủ toàn bộ hội thoại vì hết ngân sách hoặc chưa đọc hết trang. */
    truncated: boolean;
  };
}

export interface InvestigateConversationDeps {
  /** Đọc một trang bằng chứng hội thoại; bản thật gắn với DB và phiên đọc. */
  readPage: (options: SessionConversationReadOptions) => SessionConversationReadResult;
  /** Gọi model một lần và trả văn bản gốc; bản thật dùng generateText và giới hạn nền. */
  generate: (prompt: string) => Promise<string>;
  /** Chủ đề cần chú ý do tác vụ chính truyền xuống; có thể rỗng. */
  focus?: string;
  totalTokenBudget?: number;
  pageTokenBudget?: number;
}

export const INVESTIGATION_SYSTEM = `You investigate one conversation between a reader and a reading assistant, on behalf of a colleague writing this reader's completion report for a single reading session. Report what the reader did: the questions they raised, the judgments they formed, where their thinking turned, and the connections they drew to other books, work, or life. Do not summarize the book, and do not report the assistant's explanations except where one is needed to make a reader's move intelligible. Quote the reader verbatim whenever their own wording carries the point. Cover the whole excerpt rather than only its most quotable moments; a stretch where nothing notable happened simply yields no points.

Every point must carry the seq range of the messages it came from, so your colleague can read that stretch in full. Use the seq numbers shown in the transcript.

Output only a JSON object, no preamble:

{"topic":"what this conversation is about, one phrase","points":[{"kind":"question|judgment|turn|connection","text":"what the reader did, one or two sentences","quote":"the reader's own words, or null","seqFrom":3,"seqTo":5}]}`;

function renderTranscript(messages: SessionConversationMessage[]): string {
  return messages
    .map((message) => {
      const speaker = message.role === "user" ? "Reader" : "Assistant";
      const cut = message.truncated ? " …(truncated)" : "";
      return `[seq ${message.seq}] ${speaker}: ${message.text}${cut}`;
    })
    .join("\n\n");
}

function buildPagePrompt(input: {
  transcript: string;
  focus?: string;
  topic: string | null;
  background: string | null;
}): string {
  const sections = [
    input.focus ? `Your colleague is especially interested in: ${input.focus}` : null,
    input.topic ? `Topic established from earlier excerpts: ${input.topic}` : null,
    input.background
      ? `Background summary of earlier discussion (may predate this reading session; treat as context, not as evidence from it):\n${input.background}`
      : null,
    `Transcript excerpt:\n${input.transcript}`,
  ];
  return sections.filter((section) => section !== null).join("\n\n");
}

/** Giới hạn seq model trả về trong trang hiện tại để không đọc lại khoảng trống. */
function clampToPage(point: InvestigationPoint, seqs: number[]): InvestigationPoint {
  const low = Math.min(...seqs);
  const high = Math.max(...seqs);
  const from = Math.min(Math.max(point.seqFrom, low), high);
  const to = Math.min(Math.max(point.seqTo, from), high);
  return { ...point, seqFrom: from, seqTo: to };
}

/**
 * Đọc từng trang của một hội thoại, trích hành động của người đọc rồi gộp thành danh sách ý chính.
 *
 * Mỗi trang được xử lý riêng để văn bản gốc không tích tụ trong ngữ cảnh model.
 * Chỉ các ý chính được chuyển sang trang sau; mỗi lần gọi luôn chứa một trang và chủ đề đã có.
 *
 * Nếu phân tích một trang lỗi, ghi cảnh báo và tiếp tục; chỉ báo lỗi khi mọi trang đều lỗi.
 */
export async function investigateConversation(
  deps: InvestigateConversationDeps,
): Promise<ConversationInvestigation> {
  const totalBudget = deps.totalTokenBudget ?? INVESTIGATION_TOTAL_TOKEN_BUDGET;
  const pageBudget = deps.pageTokenBudget ?? INVESTIGATION_PAGE_TOKEN_BUDGET;

  const points: InvestigationPoint[] = [];
  let topic: string | null = null;
  let background: string | null = null;
  let afterSeq: number | undefined;
  let spent = 0;
  let truncated = false;
  let messagesRead = 0;
  let fromSeq: number | null = null;
  let toSeq: number | null = null;
  let pages = 0;
  let failedPages = 0;

  for (;;) {
    const remaining = totalBudget - spent;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const page = deps.readPage({
      afterSeq,
      limit: INVESTIGATION_PAGE_MESSAGE_LIMIT,
      maxLimit: INVESTIGATION_PAGE_MESSAGE_LIMIT,
      tokenBudget: Math.min(pageBudget, remaining),
    });

    if (page.compactedContext) background ??= page.compactedContext.summary;

    const sessionMessages = page.messages.filter((message) => message.context === "session");
    if (page.messages.length === 0) break;

    const transcript = renderTranscript(page.messages);
    spent += estimateTokens(transcript);
    messagesRead += sessionMessages.length;
    const seqs = page.messages.map((message) => message.seq);
    fromSeq = fromSeq === null ? Math.min(...seqs) : Math.min(fromSeq, ...seqs);
    toSeq = toSeq === null ? Math.max(...seqs) : Math.max(toSeq, ...seqs);

    pages++;
    const output = await deps.generate(
      buildPagePrompt({ transcript, focus: deps.focus, topic, background }),
    );
    const parsed: z.infer<typeof investigationPageOutput> | null = parseJsonOutput(
      output,
      investigationPageOutput,
    );
    if (parsed === null) {
      failedPages++;
      log.warn(`investigation page ${pages} produced unparseable output; skipping it`);
    } else {
      topic ??= parsed.topic;
      points.push(...parsed.points.map((point) => clampToPage(point, seqs)));
    }

    if (!page.hasMore) break;
    if (page.nextAfterSeq === null) {
      truncated = true;
      break;
    }
    afterSeq = page.nextAfterSeq;
  }

  if (pages > 0 && failedPages === pages) {
    throw new Error("conversation investigation produced no parseable output");
  }
  return {
    topic: topic ?? "untitled conversation",
    points,
    coverage: { fromSeq, toSeq, messagesRead, truncated },
  };
}
