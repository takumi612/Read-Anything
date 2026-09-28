import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FolderOpen, Upload } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { Checkbox } from "@renderer/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import { BackupExportButton } from "@renderer/settings/BackupExportButton";
import { restoreConfirmationCopy } from "@renderer/settings/restore-confirmation";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { clampBackgroundConcurrency, clampStepLimit } from "@renderer/settings/settings-logic";
import { DEFAULT_STEP_LIMIT } from "@shared/preferences";
import type { BackupInspection, BackupKind } from "@shared/backup";

export function AdvancedSettings() {
  const { t } = useTranslation();
  const stepLimit = usePrefsStore((s) => s.stepLimit);
  const setStepLimit = usePrefsStore((s) => s.setStepLimit);
  const backgroundConcurrency = usePrefsStore((s) => s.backgroundConcurrency);
  const setBackgroundConcurrency = usePrefsStore((s) => s.setBackgroundConcurrency);
  const restorePdfTabs = usePrefsStore((s) => s.restorePdfTabs);
  const setRestorePdfTabs = usePrefsStore((s) => s.setRestorePdfTabs);
  const unlimited = stepLimit === 0;
  const [busy, setBusy] = useState(false);
  // Bản sao lưu đã kiểm tra và đang chờ xác nhận; khác null thì mở hộp xác nhận.
  const [pendingRestore, setPendingRestore] = useState<BackupInspection | null>(null);

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [pdfAssociationStatus, setPdfAssociationStatus] = useState<"default" | "other" | "unknown">(
    "unknown",
  );
  const [checking, setChecking] = useState(false);
  const [latestAvailable, setLatestAvailable] = useState<string | null>(null);

  useEffect(() => {
    void window.api.app.getInfo().then((info) => {
      setAppVersion(info.version);
      setPlatform(info.platform);
    });
  }, []);

  useEffect(() => {
    if (platform !== "win32") return;
    const refresh = () => {
      void window.api.app
        .pdfAssociationStatus()
        .then(setPdfAssociationStatus)
        .catch(() => {
          setPdfAssociationStatus("unknown");
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [platform]);

  const onCheckUpdate = async () => {
    setChecking(true);
    setLatestAvailable(null);
    try {
      const res = await window.api.app.checkUpdate();
      if (res.status === "update-available") {
        setLatestAvailable(res.latestVersion);
        toast(t("update.available", "Có phiên bản mới {{version}}", { version: res.latestVersion }), {
          action: {
            label: t("update.view", "Xem"),
            onClick: () => void window.api.app.openExternal({ url: res.releaseUrl }),
          },
          duration: Infinity,
          closeButton: true,
        });
      } else if (res.status === "up-to-date") {
        toast.success(t("update.upToDate", "Bạn đang dùng phiên bản mới nhất"));
      } else {
        toast.error(t("update.checkFailed", "Không thể kiểm tra cập nhật"));
      }
    } catch {
      toast.error(t("update.checkFailed", "Không thể kiểm tra cập nhật"));
    } finally {
      setChecking(false);
    }
  };

  const onExport = async (kind: BackupKind) => {
    setBusy(true);
    try {
      const res = await window.api.backup.export({ kind });
      if (res) {
        toast.success(t("settings.backup.exportDone", "Đã xuất bản sao lưu: {{path}}", { path: res.path }));
      }
    } catch {
      toast.error(t("settings.backup.exportFailed", "Không thể xuất bản sao lưu"));
    } finally {
      setBusy(false);
    }
  };

  // Chọn và kiểm tra bản sao lưu; nếu tương thích thì hỏi xác nhận, nếu lỗi thì hiện toast.
  const onPickRestore = async () => {
    setBusy(true);
    try {
      const ins = await window.api.backup.inspect();
      if (!ins) return; // Người dùng đã hủy.
      if (!ins.compatible) {
        toast.error(
          t("settings.backup.incompatible", "Không thể khôi phục: bản sao lưu được tạo bằng phiên bản ứng dụng mới hơn ({{reason}})", {
            reason: ins.reason ?? "",
          }),
        );
        return;
      }
      setPendingRestore(ins);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "";
      toast.error(msg || t("settings.backup.readFailed", "Không thể đọc bản sao lưu này"));
    } finally {
      setBusy(false);
    }
  };

  // Sau khi khôi phục thành công main process mở lại ứng dụng; nếu lỗi thì hiện thông báo thật gồm đường dẫn phục hồi.
  const onConfirmRestore = async () => {
    const ins = pendingRestore;
    setPendingRestore(null);
    if (!ins) return;
    setBusy(true);
    try {
      await window.api.backup.restore({ path: ins.path, archiveSha256: ins.archiveSha256 });
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "";
      toast.error(msg || t("settings.backup.restoreFailed", "Khôi phục thất bại"), {
        closeButton: true,
        duration: Infinity,
      });
    } finally {
      setBusy(false);
    }
  };

  const backupWhen = pendingRestore
    ? Temporal.Instant.fromEpochMilliseconds(pendingRestore.manifest.createdAt).toLocaleString()
    : "";
  const restoreCopy = pendingRestore ? restoreConfirmationCopy(pendingRestore.manifest.kind) : null;

  return (
    <>
      <section className="space-y-4">
        <h2 className="font-serif text-lg">{t("settings.advanced", "Nâng cao")}</h2>

        <div className="flex items-start justify-between gap-3">
          <label htmlFor="step-limit" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">
              {t("settings.advanced.stepLimit", "Số bước tối đa mỗi câu trả lời")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "settings.advanced.stepLimitDesc",
                "Giới hạn số bước gọi công cụ liên tiếp trong một câu trả lời. Tăng giới hạn khi cần đọc PDF theo từng trang. Nếu chọn Không giới hạn, model hoặc bạn phải tự dừng lượt trả lời; model bị lặp có thể tiếp tục dùng token.",
              )}
            </span>
          </label>
          <div className="flex shrink-0 items-center gap-3">
            <Input
              id="step-limit"
              type="number"
              min={1}
              max={99}
              value={unlimited ? "" : stepLimit}
              disabled={unlimited}
              onChange={(e) => setStepLimit(clampStepLimit(e.target.valueAsNumber))}
              className="w-16"
            />
            <label
              htmlFor="step-limit-unlimited"
              className="flex cursor-pointer items-center gap-1.5"
            >
              <Checkbox
                id="step-limit-unlimited"
                checked={unlimited}
                onCheckedChange={(checked) => setStepLimit(checked ? 0 : DEFAULT_STEP_LIMIT)}
              />
              <span className="text-sm">{t("settings.advanced.stepLimitUnlimited", "Không giới hạn")}</span>
            </label>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <label htmlFor="background-concurrency" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">
              {t("settings.advanced.backgroundConcurrency", "Số tác vụ nền tối đa")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "settings.advanced.backgroundConcurrencyDesc",
                "Số tác vụ AI chạy nền cùng lúc, gồm tóm tắt chương và sách, đặt tên cuộc trò chuyện và rút gọn hội thoại dài. Giảm giá trị này để hạn chế mức sử dụng và tốc độ gọi API. Cài đặt không ảnh hưởng câu trả lời trong cuộc trò chuyện đang mở.",
              )}
            </span>
          </label>
          <Input
            id="background-concurrency"
            type="number"
            min={1}
            max={10}
            value={backgroundConcurrency}
            onChange={(e) =>
              setBackgroundConcurrency(clampBackgroundConcurrency(e.target.valueAsNumber))
            }
            className="w-16 shrink-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-sm font-medium">
              {t("settings.advanced.about", "Giới thiệu")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t("settings.advanced.currentVersion", "Phiên bản hiện tại")} v{appVersion ?? "…"}
              {latestAvailable
                ? ` · ${t("update.available", "Có phiên bản mới {{version}}", { version: latestAvailable })}`
                : ""}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => void onCheckUpdate()}
          >
            {t("settings.advanced.checkUpdate", "Kiểm tra cập nhật")}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-sm font-medium">
              {t("settings.advanced.dictionary.title", "Offline English–Vietnamese dictionary")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "settings.advanced.dictionary.description",
                "Word lookup works offline and does not use an AI API. Dictionary data is licensed CC BY-SA 4.0.",
              )}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void window.api.app.openExternal({
                url: "https://github.com/skypediacode/english-vietnamese-dictionary/blob/388adc0826300912e5b0311c089e0e70494b065f/ATTRIBUTION.md",
              })
            }
          >
            {t("settings.advanced.dictionary.source", "Source & attribution")}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3">
          <label htmlFor="restore-pdf-tabs" className="min-w-0 cursor-pointer">
            <span className="block text-sm font-medium">
              {t("settings.advanced.restorePdfTabs.title")}
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
              {t("settings.advanced.restorePdfTabs.description")}
            </span>
          </label>
          <Checkbox
            id="restore-pdf-tabs"
            checked={restorePdfTabs}
            onCheckedChange={(checked) => setRestorePdfTabs(checked === true)}
          />
        </div>

        {platform === "win32" && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-sm font-medium">
                {t("settings.advanced.pdfDefault.title", "Default PDF reader")}
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                {t(
                  "settings.advanced.pdfDefault.description",
                  "Choose Read-Anything for .pdf files in Windows Default Apps settings.",
                )}
              </span>
              <span className="mt-1 block text-xs font-medium">
                {pdfAssociationStatus === "default"
                  ? t("settings.advanced.pdfDefault.active")
                  : pdfAssociationStatus === "other"
                    ? t("settings.advanced.pdfDefault.inactive")
                    : t("settings.advanced.pdfDefault.unknown")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.api.app.openExternal({ url: "ms-settings:defaultapps" })}
            >
              {t("settings.advanced.pdfDefault.open", "Open Windows Settings")}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{t("settings.logs", "Nhật ký")}</span>
          <Button variant="outline" size="sm" onClick={() => void window.api.app.openLogsDir()}>
            <FolderOpen />
            {t("settings.openLogsFolder", "Mở thư mục nhật ký")}
          </Button>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">{t("settings.backup.title", "Sao lưu và khôi phục")}</span>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "settings.backup.warning",
              "Bản sao lưu gọn nhẹ không gồm tệp sách. Bản đầy đủ gồm cả sách. API key không được sao lưu; hãy nhập lại sau khi khôi phục.",
            )}
          </p>
          <div className="flex gap-2">
            <BackupExportButton disabled={busy} onExport={(kind) => void onExport(kind)} />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void onPickRestore()}
            >
              <Upload />
              {t("settings.backup.restore", "Khôi phục bản sao lưu")}
            </Button>
          </div>
        </div>
      </section>

      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {restoreCopy ? t(restoreCopy.kindKey, restoreCopy.kind) : ""}
            {` · ${t("settings.backup.restoreTitle", "Khôi phục bản sao lưu?")}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {restoreCopy && pendingRestore
              ? t(restoreCopy.confirmationKey, restoreCopy.confirmation, {
                  count: pendingRestore.manifest.bookCount,
                  when: backupWhen,
                })
              : ""}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingRestore(null)}>
              {t("settings.backup.cancel", "Hủy")}
            </Button>
            <Button variant="destructive" onClick={() => void onConfirmRestore()}>
              {t("settings.backup.restore", "Khôi phục bản sao lưu")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
