import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// backend の判定結果はモジュール内にキャッシュされるため、テストごとに
// モジュールを読み込み直す必要がある。

type BackendMocks = {
  keychain: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  secretService: { save: ReturnType<typeof vi.fn> };
  encrypted: { save: ReturnType<typeof vi.fn> };
};

/**
 * 各 backend モジュールを差し替える。available で「どの OS 相当か」を決める。
 */
function mockBackends(available: {
  keychain: boolean;
  credentialManager: boolean;
  secretService: boolean;
}): BackendMocks {
  const mocks: BackendMocks = {
    keychain: { load: vi.fn(), save: vi.fn() },
    secretService: { save: vi.fn() },
    encrypted: { save: vi.fn() },
  };

  vi.doMock("../auth/keychain.js", () => ({
    isKeychainAvailable: () => available.keychain,
    keychainSave: mocks.keychain.save,
    keychainLoad: mocks.keychain.load,
    keychainDelete: vi.fn(),
  }));
  vi.doMock("../auth/credential-manager.js", () => ({
    isCredentialManagerAvailable: () => available.credentialManager,
    credentialManagerSave: vi.fn(),
    credentialManagerLoad: vi.fn(),
    credentialManagerDelete: vi.fn(),
  }));
  vi.doMock("../auth/secret-service.js", () => ({
    isSecretServiceAvailable: () => available.secretService,
    secretServiceSave: mocks.secretService.save,
    secretServiceLoad: vi.fn(),
    secretServiceDelete: vi.fn(),
  }));
  vi.doMock("../auth/encrypted-store.js", () => ({
    encryptedSave: mocks.encrypted.save,
    encryptedLoad: vi.fn(),
    encryptedDelete: vi.fn(),
  }));

  return mocks;
}

async function importTokenStore() {
  return import("../auth/token-store.js");
}

const TOKENS = {
  access_token: "at",
  token_type: "Bearer",
  client_id: "cid",
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../auth/keychain.js");
  vi.doUnmock("../auth/credential-manager.js");
  vi.doUnmock("../auth/secret-service.js");
  vi.doUnmock("../auth/encrypted-store.js");
});

describe("backend detection", () => {
  test("prefers keychain when available", async () => {
    mockBackends({
      keychain: true,
      credentialManager: true,
      secretService: true,
    });
    const { getBackend } = await importTokenStore();
    expect(getBackend()).toBe("keychain");
  });

  test("falls back to secret-service when only it is available", async () => {
    mockBackends({
      keychain: false,
      credentialManager: false,
      secretService: true,
    });
    const { getBackend } = await importTokenStore();
    expect(getBackend()).toBe("secret-service");
  });

  test("falls back to encrypted-file when no OS store is available", async () => {
    mockBackends({
      keychain: false,
      credentialManager: false,
      secretService: false,
    });
    const { getBackend } = await importTokenStore();
    expect(getBackend()).toBe("encrypted-file");
  });
});

describe("saveTokens", () => {
  test("dispatches to the detected backend", async () => {
    const mocks = mockBackends({
      keychain: false,
      credentialManager: false,
      secretService: true,
    });
    const { saveTokens } = await importTokenStore();

    await saveTokens(TOKENS);

    expect(mocks.secretService.save).toHaveBeenCalledWith(
      JSON.stringify(TOKENS),
    );
    expect(mocks.encrypted.save).not.toHaveBeenCalled();
  });

  test("wraps a backend failure with the backend label", async () => {
    const mocks = mockBackends({
      keychain: true,
      credentialManager: false,
      secretService: false,
    });
    mocks.keychain.save.mockImplementation(() => {
      throw new Error("boom");
    });
    const { saveTokens } = await importTokenStore();

    await expect(saveTokens(TOKENS)).rejects.toThrow(/macOS Keychain.*boom/);
  });
});

describe("loadTokens", () => {
  test("parses the stored JSON", async () => {
    const mocks = mockBackends({
      keychain: true,
      credentialManager: false,
      secretService: false,
    });
    mocks.keychain.load.mockReturnValue(JSON.stringify(TOKENS));
    const { loadTokens } = await importTokenStore();

    expect(loadTokens()).toEqual(TOKENS);
  });

  test("returns null when nothing is stored", async () => {
    const mocks = mockBackends({
      keychain: true,
      credentialManager: false,
      secretService: false,
    });
    mocks.keychain.load.mockReturnValue(null);
    const { loadTokens } = await importTokenStore();

    expect(loadTokens()).toBeNull();
  });

  test("returns null and warns when the stored data is not valid JSON", async () => {
    const mocks = mockBackends({
      keychain: true,
      credentialManager: false,
      secretService: false,
    });
    mocks.keychain.load.mockReturnValue("not-json");
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadTokens } = await importTokenStore();

    expect(loadTokens()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("macOS Keychain"),
    );
  });
});
