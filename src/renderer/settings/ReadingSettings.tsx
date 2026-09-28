import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@renderer/components/ui/select";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { NOVELTY_BLOCKLIST, pickVoice } from "@renderer/reader/tts/pick-voice";
import { currentPlatform, getVoicesReady } from "@renderer/reader/tts/voices";
import { ttsController } from "@renderer/reader/tts/tts-controller";

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const AUTO_VALUE = "__auto__";
type SettingsVoiceLang = "en" | "vi";
const PREVIEW_TEXT: Record<SettingsVoiceLang, string> = {
  en: "Hello, this is a read-aloud preview.",
  vi: "Xin chào, đây là phần nghe thử chức năng đọc thành tiếng.",
};

function VoiceRow({ lang, label }: { lang: SettingsVoiceLang; label: string }) {
  const { t } = useTranslation();
  const ttsPrefs = usePrefsStore((s) => s.ttsPrefs);
  const updateTtsPrefs = usePrefsStore((s) => s.updateTtsPrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    let alive = true;
    void getVoicesReady().then((list) => {
      if (alive) setVoices(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  const options = voices.filter(
    (v) => v.lang.toLowerCase().startsWith(lang) && !NOVELTY_BLOCKLIST.includes(v.name),
  );
  const selected = ttsPrefs.voiceByLang[lang] ?? AUTO_VALUE;
  const preview = () => {
    // Dừng phiên đọc hiện tại trước khi nghe thử; hủy trực tiếp có thể khiến engine tiến nhầm.
    ttsController.stop();
    const u = new SpeechSynthesisUtterance(PREVIEW_TEXT[lang]);
    // Nghe thử dùng cùng cách chọn giọng với nội dung: tùy chọn người dùng, giọng đề xuất rồi dự phòng.
    // Ở mức tự động vẫn cần đặt voice; nếu không utterance kế thừa ngôn ngữ UI từ html và có thể chọn sai.
    const v = pickVoice(lang, voices, ttsPrefs, currentPlatform());
    if (v) u.voice = v;
    u.rate = ttsPrefs.rate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <Select
          value={selected}
          onValueChange={(val) => {
            if (val == null) return;
            const next = { ...ttsPrefs.voiceByLang };
            if (val === AUTO_VALUE) delete next[lang];
            else next[lang] = val;
            updateTtsPrefs({ voiceByLang: next });
          }}
        >
          <SelectTrigger className="w-44" aria-label={label}>
            {/* Value là tên giọng hoặc __auto__; hàm child đổi sentinel thành nhãn hiển thị. */}
            <SelectValue>
              {(v) =>
                v === AUTO_VALUE ? t("settings.tts.autoVoice", "Tự động (khuyên dùng)") : (v as string)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO_VALUE}>
              {t("settings.tts.autoVoice", "Tự động (khuyên dùng)")}
            </SelectItem>
            {options.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("settings.tts.preview", "Nghe thử")}
          onClick={preview}
        >
          <Volume2 />
        </Button>
      </div>
    </div>
  );
}

export function ReadingSettings() {
  const { t } = useTranslation();
  const ttsPrefs = usePrefsStore((s) => s.ttsPrefs);
  const updateTtsPrefs = usePrefsStore((s) => s.updateTtsPrefs);
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-lg">{t("settings.reading", "Đọc")}</h2>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t("settings.tts.title", "Đọc thành tiếng")}</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">{t("settings.tts.rate", "Tốc độ")}</span>
          <Select
            value={String(ttsPrefs.rate)}
            onValueChange={(val) => {
              if (val == null) return;
              updateTtsPrefs({ rate: Number(val) });
            }}
          >
            <SelectTrigger className="w-44" aria-label={t("settings.tts.rate", "Tốc độ")}>
              {/* Value là hệ số gốc như "1.25"; nhãn thêm dấu × như các tùy chọn. */}
              <SelectValue>{(v) => `${v as string}×`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RATE_OPTIONS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}×
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <VoiceRow lang="en" label={t("settings.tts.voiceEn", "Giọng tiếng Anh")} />
        <VoiceRow lang="vi" label={t("settings.tts.voiceVi", "Giọng tiếng Việt")} />
      </div>
    </section>
  );
}
