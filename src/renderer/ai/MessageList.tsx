import { Fragment, useState, type ReactNode } from "react";
import type { ChatStatus } from "ai";
import { getToolName } from "ai";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { BookOpen, FileText, List, ScrollText, Sparkles, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AssistantAvatar } from "@renderer/ai/AssistantAvatar";
import { assistantActivity, type AssistantActivity } from "@renderer/ai/assistant-activity";
import { useChatActions } from "@renderer/ai/chat-actions";
import { MessageEditor } from "@renderer/ai/MessageEditor";
import { textOf } from "@renderer/ai/message-text";
import { dayKind, messageCreatedAt, startsNewDay } from "@renderer/ai/message-time";
import { MessageTimestamp } from "@renderer/ai/MessageTimestamp";
import { MessageToolbar } from "@renderer/ai/MessageToolbar";
import { segments, type ToolPart } from "@renderer/ai/segments";
import { toolStepLabel, toolStepStatus } from "@renderer/ai/tool-step-label";
import type { ChatUIMessage } from "@renderer/ai/types";
import { LocalizedStreamdown } from "@renderer/components/LocalizedStreamdown";
import { cn } from "@renderer/lib/utils";
import { qk } from "@renderer/query/keys";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { makePdfLocator } from "@renderer/reader/pdf-locator";
import type { ChapterRefDto } from "@shared/library";

function linkPdfCitations(text: string): string {
  return text.replace(
    /(?<!!)\[p\.(\d{1,5})\](?!\()/gu,
    (_match, page: string, offset: number, source: string) => {
      const preceding = source.slice(Math.max(0, offset - 140), offset);
      const quote = /["“]([^"”\n]{4,100})["”]\s*$/u.exec(preceding)?.[1];
      const fragment = quote ? `?quote=${encodeURIComponent(quote)}` : "";
      return `[p.${page}](#pdf-page-${page}${fragment})`;
    },
  );
}

function PdfCitationAnchor(rawProps: unknown) {
  const { href, children, ...props } = rawProps as React.ComponentProps<"a">;
  const requestScroll = useAnnotationStore((s) => s.requestScroll);
  const currentBookId = useNavigationStore((s) => s.currentBookId);
  const isPdf = useNavigationStore((s) => s.readingContext?.format === "pdf");
  const pageCount = useNavigationStore((s) =>
    s.readingContext?.format === "pdf" ? s.readingContext.pageCount : null,
  );
  const citation = /^#pdf-page-(\d{1,5})(?:\?quote=(.+))?$/u.exec(href ?? "");
  const page = citation?.[1];
  let quote: string | undefined;
  try {
    quote = citation?.[2] ? decodeURIComponent(citation[2]).slice(0, 100) : undefined;
  } catch {
    quote = undefined;
  }
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        if (
          !page ||
          Number(page) < 1 ||
          !isPdf ||
          !currentBookId ||
          (pageCount != null && Number(page) > pageCount)
        ) {
          props.onClick?.(event);
          return;
        }
        event.preventDefault();
        requestScroll(
          makePdfLocator({ page: Number(page), scrollRatio: 0 }),
          true,
          currentBookId,
          quote,
        );
      }}
    >
      {children}
    </a>
  );
}

/**
 * Nội dung stream mờ dần vào theo từng ký tự bằng plugin animate của Streamdown.
 * Chỉ ký tự mới được bọc span khi isAnimating; ký tự đã hiện không chạy lại.
 * Chọn sep=char vì tách theo từ sẽ gộp cả đoạn văn không có dấu cách.
 * stagger phải bằng 0 để mỗi lô ký tự hiện ngay, không tạo nhiều đợt mờ chồng lên nhau.
 * duration quyết định độ dài phần đuôi đang mờ dần.
 */
const STREAM_ANIMATION = { animation: "fadeIn", sep: "char", duration: 500, stagger: 0 } as const;

export function MessageList({
  messages,
  status,
  bookId,
  hasMore,
  loadingMore,
}: {
  messages: ChatUIMessage[];
  status: ChatStatus;
  bookId: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
}) {
  const { t } = useTranslation();
  // Danh sách chương giúp bước công cụ đổi chapterId thành tên dễ đọc; dùng chung cache với ChapterList.
  const chaptersQuery = useQuery({
    queryKey: qk.chapters(bookId ?? ""),
    queryFn: () => window.api.content.chapters({ bookId: bookId ?? "" }),
    enabled: bookId !== null,
  });
  const chapters = chaptersQuery.data ?? [];
  const showAvatar = usePrefsStore((s) => s.showAgentAvatar);
  const agentName = usePrefsStore((s) => s.soul.name);
  const pdfCitations = useNavigationStore((s) => s.readingContext?.format === "pdf");
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
        <Sparkles className="size-7 text-primary/50" />
        <p className="leading-relaxed">
          {bookId
            ? t("ai.emptyHint", "Chọn một đoạn rồi nhấn Hỏi AI, hoặc nhập câu hỏi bên dưới.")
            : t("ai.emptyHintLibrary", "Hãy hỏi {{name}} bất cứ điều gì bên dưới.", { name: agentName })}
        </p>
      </div>
    );
  }
  const lastMessage = messages.at(-1);
  const lastId = lastMessage?.id;
  // Tin đang gửi hoặc stream chưa có thời gian từ DB, tạm dùng thời điểm render hiện tại.
  const nowMs = Temporal.Now.instant().epochMilliseconds;
  const timeZone = Temporal.Now.timeZoneId();
  const activity = assistantActivity(
    status,
    lastMessage?.role === "assistant" ? lastMessage.parts : undefined,
  );
  return (
    <div className="space-y-5">
      {(hasMore || loadingMore) && (
        <div className="py-2 text-center text-xs text-muted-foreground">
          {loadingMore
            ? t("ai.loadingOlder", "Đang tải tin nhắn cũ hơn…")
            : t("ai.scrollToLoadOlder", "Cuộn lên để tải tin nhắn cũ hơn")}
        </div>
      )}
      {messages.map((m, i) => {
        const createdAt = messageCreatedAt(m, nowMs);
        const prevAt = i === 0 ? null : messageCreatedAt(messages[i - 1], nowMs);
        return (
          <Fragment key={m.id}>
            {startsNewDay(prevAt, createdAt, timeZone) && (
              <DayDivider at={createdAt} nowMs={nowMs} timeZone={timeZone} />
            )}
            {m.role === "user" ? (
              <UserBubble m={m} createdAt={createdAt} timeZone={timeZone} />
            ) : (
              <AssistantBubble
                m={m}
                createdAt={createdAt}
                timeZone={timeZone}
                streaming={status === "streaming" && m.id === lastId}
                activity={m.id === lastId ? activity : null}
                chapters={chapters}
                pdfCitations={pdfCitations}
                showAvatar={showAvatar}
                groupHead={i === 0 || messages[i - 1].role !== "assistant"}
              />
            )}
          </Fragment>
        );
      })}
      {status === "submitted" && <PendingBubble showAvatar={showAvatar} />}
    </div>
  );
}

/** Dòng ngăn cách theo ngày: hôm nay và hôm qua dùng nhãn quen thuộc, ngày cũ dùng ngày tuyệt đối. */
function DayDivider({ at, nowMs, timeZone }: { at: number; nowMs: number; timeZone: string }) {
  const { t, i18n } = useTranslation();
  const kind = dayKind(at, nowMs, timeZone);
  const label =
    kind === "today"
      ? t("ai.day.today", "Hôm nay")
      : kind === "yesterday"
        ? t("ai.day.yesterday", "Hôm qua")
        : new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone }).format(at);
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

function AssistantActivityIndicator({ activity }: { activity: Exclude<AssistantActivity, null> }) {
  const { t } = useTranslation();
  const label =
    activity === "preparing"
      ? t("ai.activity.preparing", "Đang chuẩn bị câu trả lời…")
      : t("ai.activity.reasoning", "Đang suy nghĩ…");

  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex gap-1" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-primary/80 motion-safe:animate-thinking-dot" />
        <span className="size-1.5 rounded-full bg-primary/80 motion-safe:animate-thinking-dot-delay-150" />
        <span className="size-1.5 rounded-full bg-primary/80 motion-safe:animate-thinking-dot-delay-300" />
      </span>
      <span>{label}</span>
    </div>
  );
}

function PendingBubble({ showAvatar }: { showAvatar: boolean }) {
  return (
    <AssistantShell showAvatar={showAvatar} groupHead>
      <div className="max-w-full space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground">
        <AssistantActivityIndicator activity="preparing" />
      </div>
    </AssistantShell>
  );
}

function UserBubble({
  m,
  createdAt,
  timeZone,
}: {
  m: ChatUIMessage;
  createdAt: number;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const actions = useChatActions();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col items-end">
        <div className="w-full max-w-[88%]">
          <MessageEditor
            initialText={textOf(m)}
            busy={actions.busy}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              actions.editAndResend(m, text);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col items-end" data-message-id={m.id}>
      <MessageTimestamp at={createdAt} timeZone={timeZone} align="end" />
      <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-primary px-3 py-2.5 text-primary-foreground">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{textOf(m)}</div>
      </div>
      <MessageToolbar m={m} onEdit={() => setEditing(true)} />
    </div>
  );
}

function AssistantShell({
  children,
  timestamp,
  showAvatar,
  groupHead,
  messageId,
}: {
  children: ReactNode;
  /** Lớp nổi khi rê chuột trên bong bóng tin nhắn. */
  timestamp?: ReactNode;
  showAvatar: boolean;
  groupHead: boolean;
  messageId?: string;
}) {
  const body = (
    <div className="group relative flex flex-col items-start" data-message-id={messageId}>
      {timestamp}
      {children}
    </div>
  );

  if (!showAvatar) {
    return (
      <div className="max-w-[88%]" data-message-id={messageId}>
        {body}
      </div>
    );
  }

  return (
    <div className="flex max-w-[92%] items-start gap-2" data-message-id={messageId}>
      <div className="w-7 shrink-0">{groupHead && <AssistantAvatar className="size-7" />}</div>
      <div className="min-w-0 flex-1">{body}</div>
    </div>
  );
}

function AssistantBubble({
  m,
  createdAt,
  timeZone,
  streaming,
  activity,
  chapters,
  pdfCitations,
  showAvatar,
  groupHead,
}: {
  m: ChatUIMessage;
  createdAt: number;
  timeZone: string;
  streaming: boolean;
  activity: AssistantActivity;
  chapters: ChapterRefDto[];
  pdfCitations: boolean;
  showAvatar: boolean;
  groupHead: boolean;
}) {
  const segs = segments(m.parts);
  if (segs.length === 0 && !streaming) return null;

  return (
    <AssistantShell
      showAvatar={showAvatar}
      groupHead={groupHead}
      messageId={m.id}
      timestamp={
        // Trong lúc stream chưa hiện thời gian; chờ timestamp được lưu để có giá trị ổn định.
        streaming ? undefined : (
          <MessageTimestamp at={createdAt} timeZone={timeZone} align="start" />
        )
      }
    >
      <div className="max-w-full space-y-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground">
        {segs.map((s, i) =>
          s.kind === "text" ? (
            // Streamdown đã định dạng Markdown; không thêm prose để tránh xung đột khoảng cách.
            <LocalizedStreamdown
              key={i}
              animated={STREAM_ANIMATION}
              isAnimating={streaming}
              components={{ a: PdfCitationAnchor }}
            >
              {pdfCitations ? linkPdfCitations(s.text) : s.text}
            </LocalizedStreamdown>
          ) : (
            <ToolStepRow key={i} part={s.part} chapters={chapters} />
          ),
        )}
        {activity && <AssistantActivityIndicator activity={activity} />}
      </div>
      {!streaming && <MessageToolbar m={m} />}
    </AssistantShell>
  );
}

/** Icon bước công cụ lấy từ lucide theo tên công cụ; công cụ lạ dùng icon cờ lê. */
const TOOL_ICONS: Record<string, LucideIcon> = {
  getToc: List,
  getChapterSummary: ScrollText,
  readChapterText: BookOpen,
  readPage: FileText,
  searchPdf: FileText,
};

function ToolStepRow({ part, chapters }: { part: ToolPart; chapters: ChapterRefDto[] }) {
  const { t } = useTranslation();
  const status = toolStepStatus(part);
  const Icon = TOOL_ICONS[getToolName(part)] ?? Wrench;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{toolStepLabel(part, chapters, t)}</span>
      {/* i18next-instrument-ignore */}
      <span className="shrink-0">·</span>
      <span
        className={cn(
          "shrink-0",
          status === "failed" && "text-destructive",
          status === "loading" && "animate-pulse",
        )}
      >
        {status === "failed"
          ? t("ai.toolStep.failed", "Thất bại")
          : status === "done"
            ? t("ai.toolStep.done", "Hoàn tất")
            : t("ai.toolStep.loading", "Đang tải…")}
      </span>
    </div>
  );
}
