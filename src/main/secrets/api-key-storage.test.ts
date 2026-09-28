import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptApiKey,
  encryptApiKey,
  isEncryptedApiKey,
  setApiKeyStorageForTesting,
} from "@main/secrets/api-key-storage";

function fakeStorage(options: { available?: boolean; backend?: string } = {}) {
  const available = options.available ?? true;
  const backend = options.backend ?? "test-keychain";
  return {
    isEncryptionAvailable: vi.fn(() => available),
    getSelectedStorageBackend: vi.fn(() => backend),
    encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
    decryptString: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/u, "")),
  };
}

afterEach(() => setApiKeyStorageForTesting(undefined));

describe("API key storage", () => {
  it("stores only the encrypted safeStorage payload and decrypts it for provider use", () => {
    const storage = fakeStorage();
    setApiKeyStorageForTesting(storage);

    const stored = encryptApiKey("dummy-test-key");

    expect(isEncryptedApiKey(stored)).toBe(true);
    expect(stored).not.toContain("dummy-test-key");
    expect(decryptApiKey(stored)).toBe("dummy-test-key");
    expect(storage.encryptString).toHaveBeenCalledWith("dummy-test-key");
  });

  it("does not encrypt an already protected value a second time", () => {
    const storage = fakeStorage();
    setApiKeyStorageForTesting(storage);
    const protectedValue = "os:v1:already-encrypted";

    expect(encryptApiKey(protectedValue)).toBe(protectedValue);
    expect(storage.encryptString).not.toHaveBeenCalled();
  });

  it("refuses to save a key when operating-system encryption is unavailable", () => {
    setApiKeyStorageForTesting(fakeStorage({ available: false }));

    expect(() => encryptApiKey("dummy-test-key")).toThrow("Kho khóa bảo mật");
  });
});
