import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ProviderIcon } from "@lobehub/icons";
import { Check, Pencil, PlugZap, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProviderDto } from "@shared/providers";
import { PROVIDER_TYPE_LABEL } from "@shared/providers";
import { Button } from "@renderer/components/ui/button";

/** Ánh xạ nhãn provider tích hợp sang khóa icon @lobehub/icons; nhãn tích hợp là định danh ổn định. */
const BRAND_KEY: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Gemini: "google", // ProviderIcon nhận "google" làm khóa provider; "gemini" thuộc mức model.
  DeepSeek: "deepseek", // Ánh xạ provider DeepSeek đã có trong providerConfig.
};

/**
 * Một thẻ provider tự giữ state kiểm tra kết nối qua mutation cục bộ và hiển thị tại chỗ.
 * Không chia sẻ kết quả với các ModelPickerSection để kết quả không ghi đè nhầm nhau.
 * Tắt kiểm tra khi chưa có model để tránh lỗi xác thực ở backend.
 */
export function ProviderCard({
  provider,
  onEdit,
  onRemove,
}: {
  provider: ProviderDto;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const test = useMutation({
    mutationFn: () =>
      window.api.settings.providers.test({ id: provider.id, model: provider.models[0] ?? "" }),
    onSuccess: (r) => setResult(r.ok ? { ok: true } : { ok: false, message: r.message }),
    onError: (e) => setResult({ ok: false, message: (e as Error).message }),
  });

  function keyText(p: ProviderDto): string {
    return p.keyMask ?? t("settings.provider.keyNotSet", "Chưa cấu hình");
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* Provider tích hợp hiện icon thương hiệu từ @lobehub/icons theo type. */}
          {provider.isBuiltin && provider.label && BRAND_KEY[provider.label] && (
            <ProviderIcon provider={BRAND_KEY[provider.label]} type="color" size={18} />
          )}
          <span className="truncate text-sm font-medium">
            {provider.label ?? t("settings.provider.unnamed", "(chưa đặt tên)")}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {PROVIDER_TYPE_LABEL[provider.type]}
          </span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t("common.edit", "Sửa")}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => test.mutate()}
            disabled={provider.models.length === 0 || test.isPending}
            aria-label={t("settings.provider.test", "Kiểm tra kết nối")}
            title={
              provider.models.length === 0
                ? t("settings.provider.testDisabledNoModels", "Thêm một model trước khi kiểm tra")
                : t("settings.provider.test", "Kiểm tra kết nối")
            }
          >
            <PlugZap className="size-4" />
          </Button>
          {!provider.isBuiltin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={t("common.remove", "Gỡ")}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        <span>{t("settings.provider.keyLabel", "🔑 {{key}}", { key: keyText(provider) })}</span>
        <span className="ms-2">
          ·{" "}
          {t("settings.provider.modelCount", "{{count}} model", { count: provider.models.length })}
        </span>
      </div>
      {(test.isPending || result) && (
        <p
          className={
            test.isPending
              ? "mt-1 text-xs text-muted-foreground"
              : result?.ok
                ? "mt-1 flex items-center gap-1 text-xs text-primary"
                : "mt-1 flex items-center gap-1 text-xs text-destructive"
          }
        >
          {test.isPending ? (
            t("settings.provider.testing", "Đang kiểm tra…")
          ) : result?.ok ? (
            <>
              <Check className="size-3.5" /> {t("settings.provider.testOk", "Kết nối thành công")}
            </>
          ) : (
            <>
              <X className="size-3.5" />{" "}
              {t("settings.provider.testFail", "Thất bại: {{message}}", {
                message: result?.message ?? "",
              })}
            </>
          )}
        </p>
      )}
    </div>
  );
}
