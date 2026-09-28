import { usePrefsStore } from "@renderer/store/prefs-store";
import { toast } from "sonner";

/** Explicit one-time disclosure before any content leaves the app for an AI provider. */
export async function ensureAiDataConsent(): Promise<boolean> {
  if (usePrefsStore.getState().aiDataConsent) return true;
  const { default: i18n } = await import("@renderer/i18n");
  if (!window.confirm(i18n.t("ai.privacyDisclosure"))) return false;
  try {
    await window.api.preferences.set({ key: "aiDataConsent", value: true });
    usePrefsStore.setState({ aiDataConsent: true });
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err));
    return false;
  }
}
