import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { qk } from "@renderer/query/keys";
import { Button } from "@renderer/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import type { ReasoningEffort } from "@shared/preferences";
import { providerModelOptions } from "./settings-logic";

export interface ModelPickerSectionProps {
  title: string;
  /** Mô tả tùy chọn cho khối, dùng với mô hình tóm tắt. */
  description?: string;
  /** Chuỗi rỗng nghĩa là chưa chọn. */
  providerId: string;
  /** Chuỗi rỗng nghĩa là chưa chọn. */
  model: string;
  /** Khi đổi provider, bên gọi cần bỏ model cũ để tránh cặp provider/model không hợp lệ. */
  onProviderChange: (id: string) => void;
  onModelChange: (model: string) => void;
  /** Mức suy luận hiện tại; undefined nghĩa là dùng mặc định. */
  reasoningEffort?: ReasoningEffort;
  /** Tắt khi chưa chọn mô hình hoặc đang chuyển mô hình. */
  reasoningEffortDisabled?: boolean;
  /** Khi có callback thì hiển thị hàng mức suy luận; undefined đặt lại mặc định. */
  onReasoningEffortChange?: (effort: ReasoningEffort | undefined) => void;
}

/**
 * Thành phần chọn provider/model và kiểm tra kết nối dùng chung cho chat và tóm tắt.
 * Kết quả kiểm tra nằm trong state cục bộ nên hai khối không ghi đè nhau.
 */
export function ModelPickerSection({
  title,
  description,
  providerId,
  model,
  onProviderChange,
  onModelChange,
  reasoningEffort,
  reasoningEffortDisabled,
  onReasoningEffortChange,
}: ModelPickerSectionProps) {
  const { t } = useTranslation();
  const effortLabel = (v: string) =>
    v === "none"
      ? t("settings.reasoningEffort.none", "Tắt")
      : v === "low"
        ? t("settings.reasoningEffort.low", "Thấp")
        : v === "medium"
          ? t("settings.reasoningEffort.medium", "Vừa")
          : v === "high"
            ? t("settings.reasoningEffort.high", "Cao")
            : t("settings.reasoningEffort.default", "Mặc định");
  const providers = useQuery({
    queryKey: qk.providers,
    queryFn: () => window.api.settings.providers.list(),
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const selected = providers.data?.find((p) => p.id === providerId) ?? null;
  const modelOptions = providerModelOptions(selected?.models ?? [], model || null);

  const test = useMutation({
    mutationFn: () => window.api.settings.providers.test({ id: providerId, model }),
    onSuccess: (r) => setTestResult(r.ok ? { ok: true } : { ok: false, message: r.message }),
    onError: (e) => setTestResult({ ok: false, message: (e as Error).message }),
  });

  const unnamed = t("settings.provider.unnamed", "(chưa đặt tên)");

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("terms.provider")}</span>
        <Select
          value={providerId || null}
          onValueChange={(id) => {
            // Đổi provider sẽ xóa model cũ, hiện placeholder để người dùng chọn lại và bỏ kết quả kiểm tra trước.
            if (id) {
              onProviderChange(id);
              setTestResult(null);
            }
          }}
        >
          <SelectTrigger className="h-9 w-full">
            {/* Value là id provider; dùng hàm child để Base UI hiển thị tên thay cho UUID. */}
            <SelectValue placeholder={t("settings.provider.select", "Chọn $t(terms.provider)")}>
              {(value) =>
                typeof value === "string"
                  ? (providers.data?.find((p) => p.id === value)?.label ?? unnamed)
                  : t("settings.provider.select", "Chọn $t(terms.provider)")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {providers.data?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label ?? unnamed}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{t("settings.model", "Model")}</span>
        <Select
          value={model || null}
          disabled={!providerId}
          onValueChange={(m) => {
            if (m) {
              onModelChange(m);
              setTestResult(null);
            }
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={t("settings.model.select", "Chọn model")} />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onReasoningEffortChange && (
          <>
            <span className="text-xs text-muted-foreground">
              {t("settings.reasoningEffort", "Mức độ suy luận")}
            </span>
            <Select
              value={reasoningEffort ?? "default"}
              disabled={reasoningEffortDisabled}
              onValueChange={(v) => {
                // "default" nghĩa là không gửi mức riêng; đổi mức sẽ bỏ kết quả kiểm tra trước.
                if (v) {
                  onReasoningEffortChange(v === "default" ? undefined : (v as ReasoningEffort));
                  setTestResult(null);
                }
              }}
            >
              <SelectTrigger className="h-9 w-full">
                {/* Dùng hàm child để Base UI Select.Value hiển thị nhãn đã dịch thay cho giá trị gốc. */}
                <SelectValue>
                  {(value) => effortLabel(typeof value === "string" ? value : "default")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {t("settings.reasoningEffort.default", "Mặc định")}
                </SelectItem>
                <SelectItem value="none">{t("settings.reasoningEffort.none", "Tắt")}</SelectItem>
                <SelectItem value="low">{t("settings.reasoningEffort.low", "Thấp")}</SelectItem>
                <SelectItem value="medium">{t("settings.reasoningEffort.medium", "Vừa")}</SelectItem>
                <SelectItem value="high">{t("settings.reasoningEffort.high", "Cao")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!providerId || !model || test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isPending
            ? t("settings.provider.testing", "Đang kiểm tra…")
            : t("settings.provider.test", "Kiểm tra kết nối")}
        </Button>
        {testResult && (
          <span
            className={
              testResult.ok
                ? "flex items-center gap-1 text-sm text-primary"
                : "flex items-center gap-1 text-sm text-destructive"
            }
          >
            {testResult.ok ? <Check className="size-4" /> : <X className="size-4" />}
            {testResult.ok
              ? t("settings.provider.testOk", "Kết nối thành công")
              : t("settings.provider.testFail", "Thất bại: {{message}}", {
                  message: testResult.message ?? "",
                })}
          </span>
        )}
      </div>
    </section>
  );
}
