import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2 } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { usePrefsStore } from "@renderer/store/prefs-store";
import { ttsController } from "./tts-controller";
import { currentPlatform, getVoicesReady } from "./voices";
import { pickVoice } from "./pick-voice";

/** Speaks one dictionary term with an installed system voice; no text leaves the device. */
export function PronunciationButton({ term }: { term: string }) {
  const { t } = useTranslation();
  const ttsPrefs = usePrefsStore((state) => state.ttsPrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    let alive = true;
    try {
      void getVoicesReady()
        .then((available) => {
          if (alive) setVoices(available);
        })
        .catch(() => {
          if (alive) setVoices([]);
        });
    } catch {
      setVoices([]);
    }
    return () => {
      alive = false;
    };
  }, []);

  const voice = pickVoice("en", voices, ttsPrefs, currentPlatform(), { localOnly: true });
  const label = t("vocabulary.pronounce", "Listen to pronunciation");
  const unavailable = t(
    "vocabulary.localVoiceUnavailable",
    "Install an English speech voice in system settings to listen offline.",
  );

  const speak = () => {
    const text = term.trim();
    if (!voice || !text) return;
    // Keep the read-aloud controller synchronized before the shared speech engine is reused.
    ttsController.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.rate = ttsPrefs.rate;
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-description={voice ? undefined : unavailable}
      title={voice ? label : unavailable}
      disabled={!voice || !term.trim()}
      onClick={speak}
    >
      <Volume2 className="size-3.5" />
    </Button>
  );
}
