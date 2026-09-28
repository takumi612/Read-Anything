import type { DB } from "@main/db/client";
import { getPreference } from "@main/preferences/repository";
import { t } from "@main/i18n";
import type { ResolvedModel } from "@main/ai/assistant-model";

/** Main-process gate: no provider request can proceed through app AI flows before consent. */
export function requireAiDataConsent(db: DB): ResolvedModel | null {
  return getPreference(db, "aiDataConsent") === true
    ? null
    : { ok: false, reason: t("errors.aiDataConsentRequired") };
}
