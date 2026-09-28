import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AiProviderApiType, ProviderDto } from "@shared/providers";
import {
  aiProviderApiType,
  DEFAULT_BASE_URL,
  PROVIDER_TYPE_LABEL,
  resolveProviderBaseUrl,
} from "@shared/providers";
import { qk } from "@renderer/query/keys";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { ModelEditor } from "./ModelEditor";
import { providerFormToUpsertInput, type ProviderFormState } from "./settings-logic";

function initial(p: ProviderDto | null): ProviderFormState {
  return {
    id: p?.id,
    type: p?.type ?? "openai-responses",
    label: p?.label ?? "",
    // baseUrl của provider tích hợp được suy ra, không đưa vào form để tránh bị từ chối khi lưu.
    baseUrl: p?.isBuiltin ? "" : (p?.baseUrl ?? ""),
    apiKey: "",
    models: p?.models ?? [],
  };
}

export function ProviderForm({
  provider,
  onDone,
}: {
  provider: ProviderDto | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState<ProviderFormState>(() => initial(provider));
  const [editingKey, setEditingKey] = useState(provider == null || provider.keyMask === null);
  // Provider tự tạo cần baseUrl; provider tích hợp dùng endpoint mặc định hoặc suy ra từ type.
  const baseRequired = !(provider?.isBuiltin ?? false);
  // Với provider tích hợp, khóa label và baseUrl; chỉ sửa được khóa API và model. Main process cũng kiểm tra.
  const locked = provider?.isBuiltin ?? false;
  // baseUrl hiển thị được suy ra từ type với provider tích hợp; DeepSeek có hai endpoint.
  // Provider tự tạo dùng giá trị trong form.
  const displayBaseUrl =
    locked && provider ? (resolveProviderBaseUrl(provider, f.type) ?? "") : f.baseUrl;
  // Provider tự tạo chọn mọi type; provider tích hợp chỉ chọn trong compatibleApis, một giá trị thì khóa.
  const compatibleApis = provider?.compatibleApis ?? aiProviderApiType.options;
  const typeOptions = provider?.isBuiltin ? compatibleApis : aiProviderApiType.options;
  const typeLocked = (provider?.isBuiltin ?? false) && compatibleApis.length <= 1;

  const save = useMutation({
    mutationFn: () => window.api.settings.providers.upsert(providerFormToUpsertInput(f)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.providers });
      onDone();
    },
  });

  // Tên là bắt buộc; openai-compatible cũng cần baseUrl. Kiểm tra displayBaseUrl để tính cả DeepSeek tích hợp.
  const canSave = f.label.trim().length > 0 && !(baseRequired && !displayBaseUrl.trim());

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("settings.provider.type", "Loại")}</span>
        <Select
          value={f.type}
          disabled={typeLocked}
          onValueChange={(v) => {
            if (v) setF({ ...f, type: v as AiProviderApiType });
          }}
        >
          <SelectTrigger className="h-9 w-full">
            {/* Value là type gốc; hàm child đổi thành tên hiển thị. */}
            <SelectValue>
              {(v) => (typeof v === "string" ? PROVIDER_TYPE_LABEL[v as AiProviderApiType] : null)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {PROVIDER_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{t("settings.provider.name", "Tên")}</span>
        <Input
          value={f.label}
          onChange={(e) => setF({ ...f, label: e.target.value })}
          disabled={locked}
          placeholder={t("settings.provider.namePlaceholder", "(bắt buộc)")}
        />
        <span className="text-xs text-muted-foreground">
          {t("settings.provider.baseUrl", "baseURL")}
        </span>
        <Input
          value={displayBaseUrl}
          onChange={(e) => setF({ ...f, baseUrl: e.target.value })}
          disabled={locked}
          placeholder={
            DEFAULT_BASE_URL[f.type] ??
            t("settings.provider.baseUrlPlaceholder", "https://gateway-cua-ban/v1 (bắt buộc)")
          }
        />
        <span className="text-xs text-muted-foreground">
          {t("settings.provider.apiKey", "API Key")}
        </span>
        {!editingKey && provider && provider.keyMask !== null ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
              {provider.keyMask}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingKey(true)}>
              {t("common.edit", "Sửa")}
            </Button>
          </div>
        ) : (
          <Input
            type="password"
            value={f.apiKey}
            onChange={(e) => setF({ ...f, apiKey: e.target.value })}
            placeholder="sk-…"
          />
        )}
      </div>
      <ModelEditor
        models={f.models}
        onChange={(models) => setF({ ...f, models })}
        type={f.type}
        baseUrl={displayBaseUrl}
        apiKey={f.apiKey}
        id={f.id}
      />
      {save.isError && (
        <p className="text-xs text-destructive">
          {t("settings.provider.saveFailed", "Lưu thất bại: {{message}}", {
            message: (save.error as Error).message,
          })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("common.cancel", "Hủy")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSave || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t("common.saving", "Đang lưu…") : t("common.save", "Lưu")}
        </Button>
      </div>
    </div>
  );
}
