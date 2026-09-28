import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AvatarCropDialog } from "@renderer/ai/AvatarCropDialog";
import { AssistantAvatar } from "@renderer/ai/AssistantAvatar";
import { Button } from "@renderer/components/ui/button";
import { Checkbox } from "@renderer/components/ui/checkbox";
import { Input } from "@renderer/components/ui/input";
import { Textarea } from "@renderer/components/ui/textarea";
import { usePrefsStore } from "@renderer/store/prefs-store";

/**
 * Thiết lập trợ lý gồm SOUL với tên và tính cách, cùng chỉ dẫn chung.
 * Ô văn bản lưu khi mất focus; giá trị rỗng khôi phục giá trị cũ như các ô cài đặt khác.
 */
export function AgentSettings() {
  const { t } = useTranslation();
  const soul = usePrefsStore((s) => s.soul);
  const setSoul = usePrefsStore((s) => s.setSoul);
  const instructions = usePrefsStore((s) => s.instructions);
  const setInstructions = usePrefsStore((s) => s.setInstructions);
  const showAgentAvatar = usePrefsStore((s) => s.showAgentAvatar);
  const setShowAgentAvatar = usePrefsStore((s) => s.setShowAgentAvatar);
  const setAvatarBlobId = usePrefsStore((s) => s.setAvatarBlobId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const onUploadClick = () => fileInputRef.current?.click();

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Cho phép chọn lại cùng một tệp.
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast.error(t("settings.agent.avatarReadFailed", "Không thể đọc ảnh"));
    reader.readAsDataURL(file);
  };

  const onCropConfirm = async (bytes: Uint8Array<ArrayBuffer>) => {
    const r = await window.api.agent.setAvatar(bytes);
    if (r.status === "set") setAvatarBlobId(r.blobId);
    else if (r.status === "too-large")
      toast.error(t("settings.agent.avatarTooLarge", "Ảnh quá lớn. Hãy chọn ảnh dưới 2 MB."));
    else if (r.status === "unsupported")
      toast.error(t("settings.agent.avatarUnsupported", "Định dạng ảnh không được hỗ trợ"));
  };

  const onResetAvatar = async () => {
    await window.api.agent.resetAvatar();
    setAvatarBlobId(null);
  };

  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftPersona, setDraftPersona] = useState<string | null>(null);
  const [draftInstructions, setDraftInstructions] = useState<string | null>(null);

  const commitName = () => {
    if (draftName === null) return;
    const trimmed = draftName.trim();
    if (trimmed) {
      setSoul({ ...soul, name: trimmed });
    }
    setDraftName(null);
  };

  const commitPersona = () => {
    if (draftPersona === null) return;
    setSoul({ ...soul, persona: draftPersona });
    setDraftPersona(null);
  };

  const commitInstructions = () => {
    if (draftInstructions === null) return;
    setInstructions(draftInstructions);
    setDraftInstructions(null);
  };

  return (
    <section className="space-y-5">
      <h2 className="font-serif text-lg">{t("settings.agent", "Trợ lý")}</h2>

      {/* Ảnh đại diện. */}
      <div className="space-y-1.5">
        <span className="block text-sm font-medium">{t("settings.agent.avatar", "Ảnh đại diện")}</span>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "settings.agent.avatarDesc",
            "Ảnh của AI trong cuộc trò chuyện. Hỗ trợ png, jpg, webp, gif, tối đa 2 MB.",
          )}
        </p>
        <div className="flex items-center gap-3">
          <AssistantAvatar className="size-14" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onUploadClick}>
              {t("settings.agent.avatarUpload", "Tải ảnh đại diện lên")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onResetAvatar}>
              {t("settings.agent.avatarReset", "Đặt lại mặc định")}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
          <AvatarCropDialog
            open={cropSrc !== null}
            imageSrc={cropSrc}
            onConfirm={onCropConfirm}
            onOpenChange={(o) => {
              if (!o) setCropSrc(null);
            }}
          />
        </div>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <Checkbox
            checked={showAgentAvatar}
            onCheckedChange={(v) => setShowAgentAvatar(v === true)}
          />
          {t("settings.agent.avatarShowInChat", "Hiện ảnh đại diện trong cuộc trò chuyện")}
        </label>
      </div>

      {/* Tên. */}
      <div className="space-y-1.5">
        <label htmlFor="agent-name" className="block text-sm font-medium">
          {t("settings.agent.name", "Tên trợ lý")}
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("settings.agent.nameDesc", "Tên hiển thị trong giao diện trò chuyện. Không được để trống.")}
        </p>
        <Input
          id="agent-name"
          value={draftName ?? soul.name}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          placeholder={t("settings.agent.namePlaceholder", "Nhập tên trợ lý")}
          className="max-w-xs"
        />
      </div>

      {/* Tính cách. */}
      <div className="space-y-1.5">
        <label htmlFor="agent-persona" className="block text-sm font-medium">
          {t("settings.agent.persona", "Tính cách")}
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("settings.agent.personaDesc", "Mô tả tính cách và cách nói chuyện của AI bằng Markdown.")}
        </p>
        <Textarea
          id="agent-persona"
          value={draftPersona ?? soul.persona}
          onChange={(e) => setDraftPersona(e.target.value)}
          onBlur={commitPersona}
          placeholder={t("settings.agent.personaPlaceholder", "Mô tả tính cách và cách nói chuyện của trợ lý…")}
          className="min-h-28"
        />
      </div>

      {/* Chỉ dẫn chung. */}
      <div className="space-y-1.5">
        <label htmlFor="agent-instructions" className="block text-sm font-medium">
          {t("settings.agent.instructions", "Chỉ dẫn chung")}
        </label>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t(
            "settings.agent.instructionsDesc",
            "Yêu cầu bổ sung áp dụng cho mọi cuộc trò chuyện, chẳng hạn như luôn trích dẫn văn bản gốc hoặc ưu tiên trả lời bằng tiếng Việt.",
          )}
        </p>
        <Textarea
          id="agent-instructions"
          value={draftInstructions ?? instructions}
          onChange={(e) => setDraftInstructions(e.target.value)}
          onBlur={commitInstructions}
          placeholder={t("settings.agent.instructionsPlaceholder", "Nhập chỉ dẫn chung…")}
          className="min-h-28"
        />
      </div>
    </section>
  );
}
