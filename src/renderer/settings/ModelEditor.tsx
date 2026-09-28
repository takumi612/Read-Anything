import { useEffect, useState } from "react";
import { Download, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AiProviderApiType } from "@shared/providers";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Checkbox } from "@renderer/components/ui/checkbox";
import { isSubmitEnter } from "@renderer/lib/keyboard";
import { mergeModels } from "./settings-logic";

export function ModelEditor({
  models,
  onChange,
  type,
  baseUrl,
  apiKey,
  id,
}: {
  models: string[];
  onChange: (m: string[]) => void;
  type: AiProviderApiType;
  baseUrl: string;
  apiKey: string;
  id: string | undefined;
}) {
  const { t } = useTranslation();
  const [manual, setManual] = useState("");
  const [fetched, setFetched] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Khi đổi type hoặc baseUrl, xóa kết quả tải cũ để không gộp model từ endpoint trước.
  useEffect(() => {
    setFetched(null);
    setChecked(new Set());
    setErr(null);
  }, [type, baseUrl]);

  async function pull() {
    setErr(null);
    setLoading(true);
    setFetched(null);
    const res = await window.api.settings.providers.listModels({
      type,
      baseUrl: baseUrl.trim() || null,
      apiKey: apiKey.trim() || undefined,
      id,
    });
    setLoading(false);
    if (res.ok) {
      setFetched(res.models);
      // Mặc định không chọn vì người dùng thường chỉ muốn vài model.
      setChecked(new Set());
    } else {
      setErr(res.message);
    }
  }

  function addManual() {
    if (manual.trim()) {
      onChange(mergeModels(models, [manual.trim()]));
      setManual("");
    }
  }

  // openai-chat-completions không có endpoint mặc định; thiếu baseUrl thì không thể tải model.
  const cannotPull = type === "openai-chat-completions" && !baseUrl.trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("settings.model", "Model")}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={pull}
          disabled={loading || cannotPull}
          title={
            cannotPull
              ? t("settings.modelEditor.pullDisabled", "Nhập baseURL trước")
              : t("settings.modelEditor.pullTitle", "Tải danh sách model từ $t(terms.provider)")
          }
        >
          <Download className="size-4" />{" "}
          {loading
            ? t("settings.modelEditor.pulling", "Đang tải…")
            : t("settings.modelEditor.pull", "Tải danh sách model")}
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {fetched && (
        <div className="rounded-md border border-border p-2">
          {fetched.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("settings.modelEditor.noModels", "(không có model)")}
            </p>
          )}
          {fetched.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
              <Checkbox
                checked={checked.has(m)}
                onCheckedChange={(v) =>
                  setChecked((s) => {
                    const n = new Set(s);
                    if (v) {
                      n.add(m);
                    } else {
                      n.delete(m);
                    }
                    return n;
                  })
                }
              />
              {m}
            </label>
          ))}
          <Button
            type="button"
            size="sm"
            className="mt-1"
            disabled={checked.size === 0}
            onClick={() => {
              onChange(mergeModels(models, [...checked]));
              setFetched(null);
            }}
          >
            {checked.size > 0
              ? t("settings.modelEditor.addSelected", "Thêm mục đã chọn ({{n}})", { n: checked.size })
              : t("settings.modelEditor.addSelectedEmpty", "Thêm mục đã chọn")}
          </Button>
        </div>
      )}
      <ul className="space-y-1">
        {models.map((m) => (
          <li
            key={m}
            className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-sm"
          >
            {m}
            <button
              type="button"
              aria-label={t("common.remove", "Gỡ")}
              onClick={() => onChange(models.filter((x) => x !== m))}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (isSubmitEnter(e)) {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder={t("settings.modelEditor.manualPlaceholder", "Nhập tên model…")}
        />
        <Button type="button" variant="outline" size="sm" onClick={addManual}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
