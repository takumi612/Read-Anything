import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { Input } from "@renderer/components/ui/input";
import { Button } from "@renderer/components/ui/button";
import { DEFAULT_WEB_SEARCH, redactWebSearchKeys, type WebSearchConfig } from "@shared/web-search";

export function WebSearchSettings() {
  const { t } = useTranslation();
  const webSearch = usePrefsStore((s) => s.webSearch);
  const cfg: WebSearchConfig = webSearch ?? DEFAULT_WEB_SEARCH;
  const exa = cfg.backends.find((b) => b.kind === "exa-mcp");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onSaveKey = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    // An explicit empty value removes a previously saved key; omission would retain it.
    const next: WebSearchConfig = { backends: [{ kind: "exa-mcp", apiKey: apiKey.trim() }] };
    try {
      await window.api.preferences.set({ key: "webSearch", value: next });
      usePrefsStore.setState({ webSearch: redactWebSearchKeys(next) });
      setApiKey("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-lg">{t("settings.webSearch", "Tìm kiếm trên web")}</h2>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t(
          "settings.webSearch.description",
          "Có thể tìm kiếm trên web bằng Exa. Dùng nút Web trong bảng AI để bật hoặc tắt.",
        )}
      </p>
      <div className="space-y-2">
        <label htmlFor="ws-apikey" className="min-w-0">
          <span className="block text-xs text-muted-foreground">
            {t("settings.webSearch.apiKey", "Exa API Key")}
            <span className="ml-1 text-muted-foreground/60">
              {t("settings.webSearch.apiKeyOptional", "(không bắt buộc)")}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "settings.webSearch.apiKeyHint",
              "Gói miễn phí không cần key. Thêm key sẽ tăng giới hạn gọi và cải thiện kết quả.",
            )}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="ws-apikey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("settings.webSearch.apiKeyPlaceholder", "exa-… (để trống để dùng gói miễn phí)")}
          />
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void onSaveKey()}>
            {t("common.save", "Lưu")}
          </Button>
        </div>
        {exa?.hasApiKey && (
          <p className="text-xs text-muted-foreground">
            {t("settings.webSearch.keySaved", "API key đã lưu. Để trống rồi nhấn Lưu để xóa.")}
          </p>
        )}
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      </div>
    </section>
  );
}
