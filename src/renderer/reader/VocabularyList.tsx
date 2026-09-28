import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Textarea } from "@renderer/components/ui/textarea";
import { useAnnotationStore } from "@renderer/store/annotation-store";
import { useNavigationStore } from "@renderer/store/navigation-store";
import { qk } from "@renderer/query/keys";
import { makePdfLocator } from "./pdf-locator";
import { PronunciationButton } from "./tts/PronunciationButton";
import { toast } from "sonner";
import { ClearBookCategoryButton } from "./ClearBookCategoryButton";
import { parseVocabularyResult } from "./vocabulary-result";

export function VocabularyList({ bookId, isPdf = false }: { bookId: string; isPdf?: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const requestScroll = useAnnotationStore((state) => state.requestScroll);
  const vocabularyVisible = useNavigationStore(
    (state) => state.pdfVocabularyVisibleByBook[bookId] ?? true,
  );
  const setVocabularyVisible = useNavigationStore((state) => state.setPdfVocabularyVisible);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const entries = useQuery({
    queryKey: qk.vocabulary(bookId),
    queryFn: () => window.api.vocabulary.list({ bookId }),
    staleTime: Infinity,
  });
  const occurrences = useQuery({
    queryKey: qk.vocabularyOccurrences(bookId),
    queryFn: () => window.api.vocabulary.countOccurrences({ bookId }),
    enabled: isPdf && (entries.data?.length ?? 0) > 0,
    staleTime: Infinity,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.vocabularyOccurrences(bookId) });
    return qc.invalidateQueries({ queryKey: qk.vocabulary(bookId) });
  };
  const update = useMutation({ mutationFn: window.api.vocabulary.update, onSuccess: refresh });
  const remove = useMutation({ mutationFn: window.api.vocabulary.delete, onSuccess: refresh });
  const relookup = useMutation({
    mutationFn: window.api.vocabulary.refresh,
    onSuccess: refresh,
    onError: () => toast.error(t("vocabulary.refreshError")),
  });

  if (entries.isPending)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        {t("vocabulary.loading", "Loading vocabulary…")}
      </p>
    );
  if (entries.isError)
    return (
      <p className="p-3 text-sm text-destructive">
        {t("vocabulary.loadError", "Couldn't load vocabulary.")}
      </p>
    );
  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <p className="text-xs text-muted-foreground">
          {t("vocabulary.count", "{{count}} entries · saved on this device", {
            count: entries.data.length,
          })}
        </p>
        <ClearBookCategoryButton
          bookId={bookId}
          category="vocabulary"
          count={entries.data.length}
        />
        {isPdf && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={vocabularyVisible}
            aria-label={t(
              vocabularyVisible ? "vocabulary.hideHighlights" : "vocabulary.showHighlights",
            )}
            onClick={() => setVocabularyVisible(bookId, !vocabularyVisible)}
          >
            {vocabularyVisible ? <EyeOff /> : <Eye />}
            {t(vocabularyVisible ? "vocabulary.hideHighlights" : "vocabulary.showHighlights")}
          </Button>
        )}
      </div>
      {entries.data.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          {t("vocabulary.empty", "Words you look up in this PDF will appear here.")}
        </p>
      ) : (
        <>
      {occurrences.isPending && isPdf && (
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          {t("vocabulary.countingOccurrences")}
        </p>
      )}
      {occurrences.isError && isPdf && (
        <p className="px-1 pb-2 text-xs text-destructive">
          {t("vocabulary.countOccurrencesError")}
        </p>
      )}
      <ul className="space-y-1">
          {entries.data.map((entry) => {
            const meaningView = parseVocabularyResult(entry.meaning);
            const baseMetadata = meaningView.baseForm
              ? `@base: ${meaningView.baseForm}\n`
              : "";
            const visibleDraft = baseMetadata
              ? draft.replace(/^@base:[^\r\n]*\r?\n/u, "")
              : draft;
            return (
            <li key={entry.id} className="rounded-lg border border-border/70 bg-background/70 p-2">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() =>
                  requestScroll(
                    makePdfLocator({ page: entry.sourcePage, scrollRatio: 0 }),
                    false,
                    bookId,
                  )
                }
                title={t("vocabulary.goToPage", "Go to page {{page}}", { page: entry.sourcePage })}
              >
                <span className="font-semibold">{entry.term}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("vocabulary.pageShort", "p. {{page}}", { page: entry.sourcePage })}
                </span>
                {occurrences.data?.[entry.id] != null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t("vocabulary.occurrenceCount", { count: occurrences.data[entry.id] })}
                  </span>
                )}
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <PronunciationButton term={entry.term} />
                {editingId === entry.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.saveMeaning", "Save meaning")}
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate(
                          { id: entry.id, meaning: draft },
                          {
                            onSuccess: () => setEditingId(null),
                          },
                        )
                      }
                    >
                      <Check />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.cancelEdit", "Cancel edit")}
                      onClick={() => setEditingId(null)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.editMeaning", "Edit meaning")}
                      onClick={() => {
                        setDraft(entry.meaning);
                        setEditingId(entry.id);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.refresh")}
                      disabled={relookup.isPending}
                      onClick={() => relookup.mutate({ id: entry.id })}
                    >
                      <RefreshCw />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t("vocabulary.delete", "Delete word")}
                      onClick={() => remove.mutate({ id: entry.id })}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {editingId === entry.id ? (
              <Textarea
                className="mt-2 min-h-20"
                value={visibleDraft}
                onChange={(event) => setDraft(`${baseMetadata}${event.target.value}`)}
              />
            ) : (
              <div className="mt-1 space-y-1.5 text-sm">
                {meaningView.baseForm && (
                  <p className="text-xs text-muted-foreground">
                    {t("vocabulary.baseForm", "Base form: {{term}}", {
                      term: meaningView.baseForm,
                    })}
                  </p>
                )}
                {meaningView.pronunciation && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {meaningView.pronunciation}
                  </p>
                )}
                {meaningView.senses.length > 0 ? (
                  <ol className="space-y-1.5">
                    {meaningView.senses.map((sense, index) => (
                      <li key={`${index}-${sense.meaning}`} className="space-y-1">
                        {(sense.domain || sense.partOfSpeech) && (
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
                        )}
                        <p className="whitespace-pre-wrap">{sense.meaning}</p>
                        {sense.example && (
                          <p className="border-s-2 border-border ps-2 text-xs text-muted-foreground">
                            {sense.example}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="whitespace-pre-wrap">{meaningView.plainText ?? entry.meaning}</p>
                )}
              </div>
            )}
            {entry.context && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.context}</p>
            )}
            {update.isError && editingId === entry.id && (
              <p className="text-xs text-destructive">
                {t("vocabulary.saveError", "Couldn't save the meaning.")}
              </p>
            )}
            </li>
          );
        })}
      </ul>
        </>
      )}
    </div>
  );
}
