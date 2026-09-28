import { app } from "electron";
import path from "node:path";
import {
  installBundledDictionary,
  openLocalDictionary,
  resolveBundledDictionaryPath,
  type LocalDictionary,
} from "@main/vocabulary/local-dictionary";

// Pinned upstream data commit; changing this creates a fresh writable copy on upgrade.
const DATA_REVISION = "388adc0826300912e5b0311c089e0e70494b065f";
let dictionary: LocalDictionary | null = null;

export function getLocalDictionary(): LocalDictionary {
  if (dictionary) return dictionary;
  const bundledPath = resolveBundledDictionaryPath(
    app.isPackaged,
    app.getAppPath(),
    process.resourcesPath,
  );
  const installedPath = installBundledDictionary(
    bundledPath,
    path.join(app.getPath("userData"), "dictionaries", `english-vietnamese-${DATA_REVISION}.db`),
  );
  dictionary = openLocalDictionary(installedPath);
  return dictionary;
}

export function closeLocalDictionary(): void {
  dictionary?.close();
  dictionary = null;
}
