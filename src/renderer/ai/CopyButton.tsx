import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { createLogger } from "@renderer/logger";

const log = createLogger("ai");
const COPIED_RESET_MS = 1500;

export function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn timer chưa chạy khi tháo component; React Compiler không xử lý cleanup của effect.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      log.warn("copy to clipboard failed", err); // Ghi cảnh báo dù đã xử lý lỗi nhẹ nhàng.
      return; // Thất bại thì không chuyển sang trạng thái đã sao chép.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? t("ai.copied", "Đã sao chép") : t("ai.copy", "Sao chép")}
      onClick={onCopy}
      className="text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
