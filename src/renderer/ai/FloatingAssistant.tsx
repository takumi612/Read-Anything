// Trợ lý nổi dùng chung cho giao diện thư viện và thống kê, theo spec 2026-06-16 §5.4.
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@renderer/components/ui/button";
import { AIPanel } from "@renderer/ai/AIPanel";
import { useRestoreConversation } from "@renderer/ai/use-restore-conversation";
import { usePrefsStore } from "@renderer/store/prefs-store";
import type { ChatContext } from "@renderer/ai/chat-context";

const LIBRARY_CONTEXT: ChatContext = { kind: "library" };

export function FloatingAssistant() {
  const { t } = useTranslation();
  const agentName = usePrefsStore((s) => s.soul.name);
  const [open, setOpen] = useState(false);
  // Khi AppShell gắn trong thư viện hoặc thống kê, khôi phục hội thoại library gần nhất.
  // Chuyển từ sách sang thư viện sẽ gắn lại; bật tắt cửa sổ nổi thì không, AIPanel dùng openCommand còn lưu.
  useRestoreConversation(LIBRARY_CONTEXT);

  if (!open) {
    return (
      <Button
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t("ai.openLibraryAssistant", "Hỏi {{name}}", { name: agentName })}
        className="fixed bottom-6 end-6 z-40 size-12 rounded-full shadow-lg"
      >
        <MessageCircle />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 end-6 z-40 flex h-[600px] max-h-[80vh] w-96 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      <AIPanel context={LIBRARY_CONTEXT} onClose={() => setOpen(false)} />
    </div>
  );
}
