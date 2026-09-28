import { Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { qk } from "@renderer/query/keys";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { useSettingsStore } from "@renderer/store/settings-store";
import { Button } from "@renderer/components/ui/button";
import { isModelConnected, isOnboardingComplete } from "./onboarding-logic";

/** Thẻ hướng dẫn ban đầu chỉ hiện khi người dùng chưa cấu hình mô hình chat AI. */
export function OnboardingCard() {
  const { t } = useTranslation();
  const providers = useQuery({
    queryKey: qk.providers,
    queryFn: () => window.api.settings.providers.list(),
  });

  const chatModel = usePrefsStore((s) => s.chatModel);
  const dismissed = usePrefsStore((s) => s.onboardingDismissed);
  const setOnboardingDismissed = usePrefsStore((s) => s.setOnboardingDismissed);

  const openSettings = useSettingsStore((s) => s.setOpen);
  const setCategory = useSettingsStore((s) => s.setActiveCategory);

  const modelConnected = isModelConnected(chatModel, providers.data);
  const complete = isOnboardingComplete(modelConnected);

  // Không hiện khi đã bỏ qua hoặc hoàn tất; chờ query sẵn sàng để tránh trạng thái nhấp nháy.
  if (dismissed) return null;
  if (providers.isPending) return null;
  if (complete) return null;

  const onConfigureModel = () => {
    setCategory("models");
    openSettings(true);
  };

  return (
    <section
      aria-labelledby="onboarding-title"
      className="relative mb-5 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOnboardingDismissed(true)}
        aria-label={t("onboarding.skip", "Để sau")}
        className="absolute end-2 top-2 size-7 text-muted-foreground"
      >
        <X className="size-4" />
      </Button>

      <h2 id="onboarding-title" className="mb-0.5 font-serif text-base text-foreground">
        {t("onboarding.title", "Thiết lập trợ lý đọc sách AI")}
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        {t("onboarding.subtitle", "Kết nối model AI để hỏi về đoạn văn đã chọn trong lúc đọc.")}
      </p>

      <div className="flex items-center gap-3 py-1.5">
        <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm">{t("onboarding.step1.title", "Kết nối model AI")}</div>
          <div className="text-[11px] text-muted-foreground">
            {t("onboarding.step1.hint", "Thêm API key của nhà cung cấp và chọn model trò chuyện")}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onConfigureModel}>
          {t("onboarding.step1.action", "Thiết lập")}
        </Button>
      </div>
    </section>
  );
}
