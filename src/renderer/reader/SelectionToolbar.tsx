import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Highlighter, Languages, Sparkles, StickyNote } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import { qk } from "@renderer/query/keys";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useAiActions } from "@renderer/ai/use-ai-actions";
import { parsePdfLocatorRange } from "./pdf-locator";
import { PronunciationButton } from "./tts/PronunciationButton";
import { parseVocabularyResult } from "./vocabulary-result";
import { annotationColorHex, resolveToolbarHighlightStyle } from "./annotation-colors";
import { isVocabularyLookupTerm } from "@shared/vocabulary";
import type { VocabularyEntryDto } from "@shared/vocabulary";
import type { AnnotationStyle } from "@shared/annotations";

function isMissingOfflineDictionaryEntry(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /word not found in the offline dictionary|không tìm thấy từ trong từ điển ngoại tuyến/iu.test(
    message,
  );
}

function normalizeSelectedTerm(term: string): string {
  return term.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export function SelectionToolbar() {
  const { t } = useTranslation();
  const selection = useAnnotationStore((s) => s.selection);
  const openStyleBar = useAnnotationStore((s) => s.openStyleBar);
  const openNoteModal = useAnnotationStore((s) => s.openNoteModal);
  const setSelection = useAnnotationStore((s) => s.setSelection);
  const styleBar = useAnnotationStore((s) => s.styleBar);
  const noteModal = useAnnotationStore((s) => s.noteModal);
  const bookId = useNavigationStore((s) => s.currentBookId);
  const lastStyle = usePrefsStore((s) => s.lastHighlightStyle);
  const annotationPalette = usePrefsStore((s) => s.annotationPalette);
  const toolbarHighlightStyle = resolveToolbarHighlightStyle(lastStyle, annotationPalette);
  const { startAiAction } = useAiActions();
  const qc = useQueryClient();
  const [lookup, setLookup] = useState<{
    selectionKey: string;
    entry: VocabularyEntryDto | null;
    error: "missing" | "unavailable" | null;
  } | null>(null);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const refreshVocabulary = (entry: VocabularyEntryDto) => {
    void qc.invalidateQueries({ queryKey: qk.vocabulary(entry.bookId) });
    void qc.invalidateQueries({ queryKey: qk.vocabularyOccurrences(entry.bookId) });
  };
  const vocabularyM = useMutation({
    mutationFn: window.api.vocabulary.lookup,
    onSuccess: refreshVocabulary,
  });
  const createM = useMutation({
    mutationFn: window.api.annotations.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.annotations(bookId ?? "") }),
  });
  // Khi thanh kiểu hoặc hộp ghi chú mở, ẩn thanh chính thay vì chồng lên nhau.
  // Vùng chọn vẫn trong store để thanh kiểu và hộp ghi chú đọc locatorRange/selectedText.
  if (styleBar || noteModal) return null;
  if (!selection || !selection.rect) return null;

  const { rect } = selection;
  const selectedWord = selection.selectionText.trim();
  const page = selection.locatorRange
    ? parsePdfLocatorRange(selection.locatorRange)?.page
    : undefined;
  // PDF locator is authoritative here; readingContext can be briefly null while a page hydrates.
  const canLookUp = page != null && isVocabularyLookupTerm(selectedWord);
  const normalizedSelectedWord = normalizeSelectedTerm(selectedWord);
  const selectionKey = `${bookId}:${page}:${selection.locatorRange}:${normalizedSelectedWord}`;
  const currentLookup = lookup?.selectionKey === selectionKey ? lookup : null;
  const lookupView = currentLookup?.entry
    ? parseVocabularyResult(currentLookup.entry.meaning)
    : null;
  const halfWidth = Math.min(280, Math.max(0, (window.innerWidth - 24) / 2));
  const left = Math.min(
    Math.max(rect.x + rect.width / 2, halfWidth + 12),
    window.innerWidth - halfWidth - 12,
  );
  const below = rect.y + rect.height + 12 + 360 < window.innerHeight;
  const top = below ? rect.y + rect.height + 10 : rect.y - 10;

  const lookUpWord = () => {
    if (!bookId || !page || !canLookUp) return;
    setLookup({ selectionKey, entry: null, error: null });
    vocabularyM.mutate(
      {
        bookId,
        term: selectedWord,
        context: selection.paragraphCurrent,
        sourcePage: page,
      },
      {
        onSuccess: (entry) => setLookup({ selectionKey, entry, error: null }),
        onError: (err) =>
          setLookup({
            selectionKey,
            entry: null,
            error: isMissingOfflineDictionaryEntry(err) ? "missing" : "unavailable",
          }),
      },
    );
  };

  // Chọn tô sáng sẽ tạo ngay với kiểu dùng lần trước rồi mở thanh kiểu để đổi màu.
  // Cuộn hoặc nhấn nơi khác đóng thanh nhưng giữ vùng tô sáng.
  const applyHighlight = (style: AnnotationStyle = toolbarHighlightStyle) => {
    if (!bookId || !selection.locatorRange || !selection.selectionText) return;
    createM.mutate(
      {
        bookId,
        style,
        note: "",
        selectedText: selection.selectionText,
        locatorRange: selection.locatorRange,
      },
      {
        onSuccess: (anno) =>
          openStyleBar({ rect, target: { type: "edit", annotationId: anno.id } }),
      },
    );
    setSelection(null);
  };

  // Khi thêm ghi chú, chụp locatorRange và selectedText vào hộp để lưu không phụ thuộc vùng chọn có thể mất.
  const addNote = () => {
    if (!selection.locatorRange || !selection.selectionText) return;
    openNoteModal({
      target: { type: "create" },
      anchor: { locatorRange: selection.locatorRange, selectedText: selection.selectionText },
    });
  };

  return (
    <div
      onMouseDown={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest("[data-selection-lookup-panel]") !== null) {
          return;
        }
        event.preventDefault();
      }}
      style={{
        position: "fixed",
        left,
        top,
        transform: below ? "translateX(-50%)" : "translate(-50%, -100%)",
        zIndex: 50,
      }}
      className="flex w-max max-w-[calc(100vw-24px)] flex-col items-center gap-0"
    >
      <div
        data-selection-actions
        className={cn(
          "flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-0.5 whitespace-nowrap border border-border bg-popover p-1 shadow-lg",
          currentLookup ? "rounded-t-xl rounded-b-none border-b-0 shadow-none" : "rounded-xl",
        )}
      >
        {canLookUp && (
          <ToolBtn
            primary
            onClick={lookUpWord}
            icon={<Languages className="size-3.5" />}
            label={t("vocabulary.lookup", "Look up")}
          />
        )}
        <div className="relative flex items-center">
          <ToolBtn
            onClick={() => applyHighlight()}
            icon={<Highlighter className="size-3.5" />}
            label={t("reader.selection.highlight", "Highlight")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("reader.selection.highlightColors", "Highlight colors")}
            aria-expanded={showHighlightPalette}
            onClick={() => setShowHighlightPalette((open) => !open)}
          >
            <ChevronDown className="size-3" />
          </Button>
          {showHighlightPalette && (
            <div
              role="group"
              aria-label={t("reader.selection.highlightColors", "Highlight colors")}
              className="absolute start-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-border bg-popover p-1.5 shadow-lg"
            >
              {annotationPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={t("reader.highlight.colorLabel", "Highlight {{color}}", {
                    color,
                  })}
                  onClick={() => {
                    setShowHighlightPalette(false);
                    applyHighlight(color);
                  }}
                  className={cn(
                    "size-5 rounded-full ring-offset-1 ring-offset-popover transition hover:scale-110",
                    lastStyle === color && "ring-2 ring-foreground/60",
                  )}
                  style={{ backgroundColor: annotationColorHex(color) }}
                />
              ))}
            </div>
          )}
        </div>
        <ToolBtn
          onClick={addNote}
          icon={<StickyNote className="size-3.5" />}
          label={t("reader.selection.addNote", "Add note")}
        />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <ToolBtn
          onClick={() => void startAiAction(null)}
          icon={<Sparkles className="size-3.5 text-primary" />}
          label={t("reader.selection.askAi", "Ask AI")}
        />
      </div>
      {currentLookup && (
        <div
          className="max-h-[min(20rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-24px))] overflow-y-auto rounded-t-none rounded-b-xl border border-t-0 border-border bg-popover p-3 text-sm text-popover-foreground whitespace-normal shadow-lg"
          role="status"
          data-selection-lookup-panel
        >
          {currentLookup.error ? (
            <p
              className={cn(
                "leading-relaxed",
                currentLookup.error === "unavailable" && "text-destructive",
              )}
              role="alert"
            >
              {currentLookup.error === "missing"
                ? t("vocabulary.lookupMissing", "No offline dictionary entry for “{{term}}”.", {
                    term: selectedWord,
                  })
                : t(
                    "vocabulary.lookupUnavailable",
                    "The offline dictionary couldn't complete this lookup. Try again.",
                  )}
            </p>
          ) : currentLookup.entry ? (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {t("vocabulary.offlineDictionary", "Offline dictionary")}
                  </p>
                  <p className="break-words text-base font-semibold">
                    {currentLookup.entry.term}
                  </p>
                  {lookupView?.baseForm && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("vocabulary.baseForm", "Base form: {{term}}", {
                        term: lookupView.baseForm,
                      })}
                    </p>
                  )}
                  {lookupView?.pronunciation && (
                    <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground">
                      {lookupView.pronunciation}
                    </p>
                  )}
                </div>
                <PronunciationButton term={currentLookup.entry.term} />
              </div>
              {lookupView?.senses.length ? (
                <ol className="space-y-2 border-t border-border/60 pt-2">
                  {lookupView.senses.map((sense, index) => (
                    <li key={`${index}-${sense.meaning}`} className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {sense.partOfSpeech && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                            {sense.partOfSpeech}
                          </span>
                        )}
                        {sense.domain && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.7rem] text-primary">
                            {sense.domain}
                          </span>
                        )}
                      </div>
                      <p className="break-words leading-relaxed">{sense.meaning}</p>
                      {sense.example && (
                        <p className="break-words border-s-2 border-border ps-2 text-xs leading-relaxed text-muted-foreground">
                          {sense.example}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-t border-border/60 pt-2 break-words leading-relaxed whitespace-pre-wrap">
                  {lookupView?.plainText ?? currentLookup.entry.meaning}
                </p>
              )}
            </div>
          ) : (
            <span>{t("vocabulary.lookupPending", "Looking up…")}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className={cn(primary && "text-primary")}>
      {icon}
      <span>{label}</span>
    </Button>
  );
}
