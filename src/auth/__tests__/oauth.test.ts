import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { OAuthConfig } from "../../config/index.js";
import type { TokenSet } from "../types.js";

/** OAuth login/refresh の保存内容を検証するため、token-store をモックする。 */
const saveTokens = vi.fn<(tokens: TokenSet) => Promise<void>>();
const closeCallback = vi.fn();
const startCallbackServer = vi.fn();
const openBrowser = vi.fn();

const OAUTH: OAuthConfig = {
  clientId: "cid",
  scope: "read:post",
  apiBaseUrl: "https://api.esa.io",
};

const CURRENT: TokenSet = {
  access_token: "old-at",
  refresh_token: "old-rt",
  token_type: "Bearer",
  client_id: "cid",
};

/** discovery はモックし、トークンエンドポイントの応答のみを差し替える。 */
function mockTokenEndpoint(body: Record<string, unknown>, status = 200) {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.resetModules();
  saveTokens.mockReset();
  saveTokens.mockResolvedValue();
  closeCallback.mockReset();
  startCallbackServer.mockReset();
  openBrowser.mockReset();
  vi.doMock("../token-store.js", () => ({ saveTokens }));
  vi.doMock("../callback.js", () => ({ startCallbackServer }));
  vi.doMock("../open-browser.js", () => ({ openBrowser }));
  // ネットワークに出ずにトークンエンドポイントを解決させる。
  vi.doMock("../discovery.js", () => ({
    fetchMetadata: async () => ({
      issuer: "https://esa.io/",
      authorization_endpoint: "https://api.esa.io/oauth/authorize",
      token_endpoint: "https://api.esa.io/oauth/token",
      revocation_endpoint: "https://api.esa.io/oauth/revoke",
    }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("../token-store.js");
  vi.doUnmock("../callback.js");
  vi.doUnmock("../open-browser.js");
  vi.doUnmock("../discovery.js");
});

test("completes the PKCE login flow and saves the returned tokens", async () => {
  startCallbackServer.mockResolvedValue({
    port: 3210,
    codePromise: Promise.resolve("authorization-code"),
    close: closeCallback,
  });
  const fetchMock = mockTokenEndpoint({
    access_token: "new-at",
    refresh_token: "new-rt",
    token_type: "Bearer",
    expires_in: 3600,
    created_at: 1_700_000_000,
    scope: "read:post",
  });
  const { login } = await import("../oauth.js");

  const tokens = await login(OAUTH);

  const authorizationUrl = new URL(openBrowser.mock.calls[0][0] as string);
  expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
  expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
    "S256",
  );
  expect(authorizationUrl.searchParams.get("state")).not.toBe("");
  expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:3210/callback",
  );

  const [endpoint, init] = fetchMock.mock.calls[0];
  expect(endpoint).toBe("https://api.esa.io/oauth/token");
  const form = init?.body as URLSearchParams;
  expect(form.get("grant_type")).toBe("authorization_code");
  expect(form.get("code")).toBe("authorization-code");
  expect(form.get("code_verifier")).toBeTruthy();
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(tokens).toEqual(
    expect.objectContaining({
      access_token: "new-at",
      refresh_token: "new-rt",
      expires_at: 1_700_003_600,
    }),
  );
  expect(saveTokens).toHaveBeenCalledWith(tokens);
  expect(closeCallback).toHaveBeenCalledOnce();
});

test("closes the callback server when the token exchange fails", async () => {
  startCallbackServer.mockResolvedValue({
    port: 3210,
    codePromise: Promise.resolve("authorization-code"),
    close: closeCallback,
  });
  mockTokenEndpoint({ error: "invalid_grant" }, 400);
  const { login } = await import("../oauth.js");

  await expect(login(OAUTH)).rejects.toThrow(/400/);

  expect(saveTokens).not.toHaveBeenCalled();
  expect(closeCallback).toHaveBeenCalledOnce();
});

test("keeps the existing refresh_token when the response omits it", async () => {
  // RFC 6749 Section 6: リフレッシュ応答の refresh_token は任意。
  mockTokenEndpoint({
    access_token: "new-at",
    token_type: "Bearer",
    expires_in: 3600,
    created_at: 1_700_000_000,
  });
  const { refresh } = await import("../oauth.js");

  const next = await refresh(OAUTH, CURRENT);

  expect(next.access_token).toBe("new-at");
  expect(next.refresh_token).toBe("old-rt");
  expect(saveTokens).toHaveBeenCalledWith(
    expect.objectContaining({ refresh_token: "old-rt" }),
  );
});

test("uses the rotated refresh_token when the response provides one", async () => {
  mockTokenEndpoint({
    access_token: "new-at",
    refresh_token: "new-rt",
    token_type: "Bearer",
    expires_in: 3600,
    created_at: 1_700_000_000,
  });
  const { refresh } = await import("../oauth.js");

  const next = await refresh(OAUTH, CURRENT);

  expect(next.refresh_token).toBe("new-rt");
  expect(next.expires_at).toBe(1_700_000_000 + 3600);
});

test("throws without calling the endpoint when there is no refresh_token", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const { refresh } = await import("../oauth.js");

  await expect(
    refresh(OAUTH, { ...CURRENT, refresh_token: undefined }),
  ).rejects.toThrow(/No refresh_token/);
  expect(fetchSpy).not.toHaveBeenCalled();
});
