// Gom trạng thái UI giữa các cột vào một context nhỏ (thay cho thư viện quản lý trạng thái): chương hiện tại, trạng thái thu gọn bảng, vùng chọn,
// chips/văn bản nháp, hội thoại (qua useMockChat), trạng thái tóm tắt chương và tùy chọn đọc.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Annotation,
  ChatMessage,
  Chip,
  HighlightColor,
  PresetId,
  ReaderPrefs,
  SelectionInfo,
  SummaryStatus,
} from "#/mock/types";
import { BOOK, DEFAULT_PREFS, PRESETS, SEED_ANNOTATIONS, buildChips } from "#/mock/fixtures";
import { useMockChat } from "#/mock/useMockChat";

const SUMMARY_CYCLE: SummaryStatus[] = ["pending", "generating", "ready", "unavailable"];

let annoCounter = 0;

interface HighlightPopoverState {
  annotationId: string;
  x: number;
  y: number;
  autoFocusNote: boolean;
}

type ParagraphHighlight = {
  annId: string;
  color: HighlightColor;
  start: number;
  end: number;
  hasNote: boolean;
};

interface ReaderAIValue {
  book: typeof BOOK;
  currentChapterId: string;
  setCurrentChapterId: (id: string) => void;

  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  headerOpen: boolean;
  setHeaderOpen: (open: boolean) => void;

  // Vùng chọn (được Reader ghi vào; điều khiển thanh công cụ nổi)
  selection: SelectionInfo | null;
  setSelection: (s: SelectionInfo | null) => void;

  // Bản nháp (được điền sẵn sau khi chọn thao tác AI, chờ gửi)
  draftChips: Chip[];
  draftText: string;
  setDraftText: (t: string) => void;
  focusNonce: number; // Tăng dần → đưa tiêu điểm vào Composer
  startAiAction: (preset: PresetId | null) => void;
  /** Các chương mà vùng chọn trong bản nháp hiện tại chạm tới (length > 1 = chọn xuyên chương → hội thoại riêng). */
  draftChapterIds: string[];

  // Hội thoại
  messages: ChatMessage[];
  isStreaming: boolean;
  sendDraft: () => void;
  stop: () => void;
  newConversation: () => void;
  /** Các chương có vùng chọn đã gửi chạm tới (xác định phạm vi hội thoại: một chương / hội thoại riêng xuyên chương). */
  conversationChapterIds: string[];

  // Đánh dấu hội thoại trên thanh bên (chỉ hiển thị)
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Trạng thái tóm tắt chương hiện tại (có thể luân phiên để minh họa các trạng thái dự phòng)
  summaryStatus: SummaryStatus;
  cycleSummaryStatus: (chapterId?: string) => void;
  summaryStatusOf: (chapterId: string) => SummaryStatus;

  // Đánh dấu / ghi chú
  annotations: Annotation[];
  /** Tạo một mục đánh dấu từ vùng chọn hiện tại; trả về id (trả về null nếu không có vùng chọn). */
  addAnnotation: (color: HighlightColor, note?: string) => string | null;
  updateAnnotation: (id: string, patch: Partial<Pick<Annotation, "color" | "note">>) => void;
  removeAnnotation: (id: string) => void;
  /** Lấy các đoạn đánh dấu khớp với một đoạn văn (để hiển thị tô sáng trong nội dung). */
  annotationsForParagraph: (chapterId: string, paragraphIndex: number) => ParagraphHighlight[];
  highlightPopover: HighlightPopoverState | null;
  openHighlightPopover: (id: string, x: number, y: number, autoFocusNote?: boolean) => void;
  closeHighlightPopover: () => void;

  // Tùy chọn đọc
  prefs: ReaderPrefs;
  updatePrefs: (patch: Partial<ReaderPrefs>) => void;
}

const Ctx = createContext<ReaderAIValue | null>(null);

export function ReaderAIProvider({ children }: { children: ReactNode }) {
  const [currentChapterId, setCurrentChapterId] = useState(BOOK.chapters[0].id);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [headerOpen, setHeaderOpen] = useState(true);
  const [selection, setSelectionState] = useState<SelectionInfo | null>(null);
  const [draftChips, setDraftChips] = useState<Chip[]>([]);
  const [draftText, setDraftText] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const [draftChapterIds, setDraftChapterIds] = useState<string[]>([]);
  const [conversationChapterIds, setConversationChapterIds] = useState<string[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>("conv-1");
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [statuses, setStatuses] = useState<Record<string, SummaryStatus>>(() =>
    Object.fromEntries(BOOK.chapters.map((c) => [c.id, c.summaryStatus])),
  );
  const [annotations, setAnnotations] = useState<Annotation[]>(SEED_ANNOTATIONS);
  const [highlightPopover, setHighlightPopover] = useState<HighlightPopoverState | null>(null);

  const chat = useMockChat();
  const selectionRef = useRef<SelectionInfo | null>(null);
  const lastParagraph = useRef<string | null>(null);

  const setSelection = useCallback((s: SelectionInfo | null) => {
    selectionRef.current = s;
    setSelectionState(s);
  }, []);

  const startAiAction = useCallback(
    (preset: PresetId | null) => {
      const sel = selectionRef.current;
      if (!sel) return;
      if (sel.chapterIds[0]) setCurrentChapterId(sel.chapterIds[0]);
      setDraftChapterIds(sel.chapterIds);
      setDraftChips(buildChips(sel));
      setDraftText(preset ? (PRESETS.find((p) => p.id === preset)?.template ?? "") : "");
      setPanelOpen(true);
      setFocusNonce((n) => n + 1);
      if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
      setSelection(null); // Ẩn thanh công cụ; chips đã được đưa vào bản nháp
    },
    [setSelection],
  );

  const sendDraft = useCallback(() => {
    if (draftChips.length === 0 && draftText.trim() === "") return;
    const text = draftText.trim() || "请就选中的文本展开说说。";

    // Khử trùng lặp đoạn văn: nếu trùng với đoạn được thêm lần trước thì bỏ chip paragraph ở lượt này
    const para = draftChips.find((c) => c.id === "paragraph");
    const chips =
      para && para.content === lastParagraph.current
        ? draftChips.filter((c) => c.id !== "paragraph")
        : draftChips;
    if (para) lastParagraph.current = para.content;

    chat.send(text, chips);
    if (draftChapterIds.length) setConversationChapterIds(draftChapterIds);
    setDraftChips([]);
    setDraftText("");
    setDraftChapterIds([]);
    setPanelOpen(true);
  }, [chat, draftChips, draftText, draftChapterIds]);

  const newConversation = useCallback(() => {
    chat.reset();
    setDraftChips([]);
    setDraftText("");
    setDraftChapterIds([]);
    setConversationChapterIds([]);
    lastParagraph.current = null;
    setSelection(null);
    setActiveConversationId(null);
  }, [chat, setSelection]);

  const cycleSummaryStatus = useCallback(
    (chapterId?: string) => {
      const target = chapterId ?? currentChapterId;
      setStatuses((prev) => {
        const cur = prev[target] ?? "pending";
        const next = SUMMARY_CYCLE[(SUMMARY_CYCLE.indexOf(cur) + 1) % SUMMARY_CYCLE.length];
        return { ...prev, [target]: next };
      });
    },
    [currentChapterId],
  );

  const summaryStatusOf = useCallback(
    (chapterId: string): SummaryStatus => statuses[chapterId] ?? "pending",
    [statuses],
  );

  const updatePrefs = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const addAnnotation = useCallback(
    (color: HighlightColor, note = ""): string | null => {
      const sel = selectionRef.current;
      if (!sel || sel.ranges.length === 0) return null;
      const id = `anno-${++annoCounter}`;
      const ann: Annotation = {
        id,
        color,
        note,
        text: sel.selectionText,
        chapterId: sel.ranges[0].chapterId,
        ranges: sel.ranges,
        createdAt: Date.now(),
      };
      setAnnotations((prev) => [...prev, ann]);
      if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
      setSelection(null); // Ẩn thanh công cụ vùng chọn
      return id;
    },
    [setSelection],
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Pick<Annotation, "color" | "note">>) => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [],
  );

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setHighlightPopover((p) => (p?.annotationId === id ? null : p));
  }, []);

  const annotationsForParagraph = useCallback(
    (chapterId: string, paragraphIndex: number): ParagraphHighlight[] => {
      const out: ParagraphHighlight[] = [];
      for (const a of annotations)
        for (const r of a.ranges)
          if (r.chapterId === chapterId && r.paragraphIndex === paragraphIndex)
            out.push({
              annId: a.id,
              color: a.color,
              start: r.start,
              end: r.end,
              hasNote: a.note.trim() !== "",
            });
      return out;
    },
    [annotations],
  );

  const openHighlightPopover = useCallback(
    (annotationId: string, x: number, y: number, autoFocusNote = false) => {
      setHighlightPopover({ annotationId, x, y, autoFocusNote });
    },
    [],
  );
  const closeHighlightPopover = useCallback(() => setHighlightPopover(null), []);

  const value = useMemo<ReaderAIValue>(
    () => ({
      book: BOOK,
      currentChapterId,
      setCurrentChapterId,
      panelOpen,
      setPanelOpen,
      sidebarOpen,
      setSidebarOpen,
      headerOpen,
      setHeaderOpen,
      selection,
      setSelection,
      draftChips,
      draftText,
      setDraftText,
      focusNonce,
      startAiAction,
      draftChapterIds,
      messages: chat.messages,
      isStreaming: chat.isStreaming,
      sendDraft,
      stop: chat.stop,
      newConversation,
      conversationChapterIds,
      activeConversationId,
      setActiveConversationId,
      summaryStatus: statuses[currentChapterId] ?? "pending",
      cycleSummaryStatus,
      summaryStatusOf,
      annotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      annotationsForParagraph,
      highlightPopover,
      openHighlightPopover,
      closeHighlightPopover,
      prefs,
      updatePrefs,
    }),
    [
      currentChapterId,
      panelOpen,
      sidebarOpen,
      headerOpen,
      selection,
      setSelection,
      draftChips,
      draftText,
      focusNonce,
      startAiAction,
      draftChapterIds,
      chat.messages,
      chat.isStreaming,
      chat.stop,
      sendDraft,
      newConversation,
      conversationChapterIds,
      activeConversationId,
      statuses,
      cycleSummaryStatus,
      summaryStatusOf,
      annotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      annotationsForParagraph,
      highlightPopover,
      openHighlightPopover,
      closeHighlightPopover,
      prefs,
      updatePrefs,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReaderAI(): ReaderAIValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReaderAI must be used within ReaderAIProvider");
  return v;
}
