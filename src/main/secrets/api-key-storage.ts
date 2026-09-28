import { safeStorage } from "electron";

const PREFIX = "os:v1:";

interface StorageApi {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

let testStorage: StorageApi | undefined;

/** Inject a deterministic storage adapter in Electron-free repository tests. */
export function setApiKeyStorageForTesting(storage: StorageApi | undefined): void {
  testStorage = storage;
}

function getStorage(): StorageApi | undefined {
  return testStorage ?? (safeStorage as StorageApi | undefined);
}

function storageAvailable(): boolean {
  const storage = getStorage();
  if (!storage?.isEncryptionAvailable()) return false;
  // Electron can fall back to reversible plaintext protection on Linux desktops with no keyring.
  return process.platform !== "linux" || storage.getSelectedStorageBackend() !== "basic_text";
}

export function encryptApiKey(value: string): string {
  if (value.startsWith(PREFIX)) return value;
  if (!storageAvailable()) {
    throw new Error("Kho khóa bảo mật của hệ điều hành chưa sẵn sàng. Hãy cấu hình lại sau khi đăng nhập.");
  }
  return `${PREFIX}${getStorage()!.encryptString(value).toString("base64")}`;
}

export function decryptApiKey(value: string | null): string | null {
  if (value == null || !value.startsWith(PREFIX)) return value;
  const storage = getStorage();
  if (!storage?.isEncryptionAvailable()) {
    throw new Error("Không thể mở khóa API trên thiết bị này; kho khóa hệ điều hành chưa sẵn sàng.");
  }
  return storage.decryptString(Buffer.from(value.slice(PREFIX.length), "base64"));
}

export function isEncryptedApiKey(value: string): boolean {
  return value.startsWith(PREFIX);
}
