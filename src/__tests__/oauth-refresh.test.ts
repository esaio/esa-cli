import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TokenSet } from "../auth/types.js";
import type { OAuthConfig } from "../config/index.js";

/**
 * refresh() のトークン引き継ぎを検証する。
 * token-store は保存内容を確認するためにモックする。
 */
const saveTokens = vi.fn<(tokens: TokenSet) => Promise<void>>();

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
function mockTokenEndpoint(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

beforeEach(() => {
  vi.resetModules();
  saveTokens.mockReset();
  saveTokens.mockResolvedValue();
  vi.doMock("../auth/token-store.js", () => ({ saveTokens }));
  // refresh は discovery からトークンエンドポイントを解決するため、
  // ここではネットワークに出ずに固定のメタデータを返す。
  vi.doMock("../auth/discovery.js", () => ({
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
  vi.doUnmock("../auth/token-store.js");
  vi.doUnmock("../auth/discovery.js");
});

test("keeps the existing refresh_token when the response omits it", async () => {
  // RFC 6749 Section 6: リフレッシュ応答の refresh_token は任意。
  mockTokenEndpoint({
    access_token: "new-at",
    token_type: "Bearer",
    expires_in: 3600,
    created_at: 1_700_000_000,
  });
  const { refresh } = await import("../auth/oauth.js");

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
  const { refresh } = await import("../auth/oauth.js");

  const next = await refresh(OAUTH, CURRENT);

  expect(next.refresh_token).toBe("new-rt");
  expect(next.expires_at).toBe(1_700_000_000 + 3600);
});

test("throws without calling the endpoint when there is no refresh_token", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const { refresh } = await import("../auth/oauth.js");

  await expect(
    refresh(OAUTH, { ...CURRENT, refresh_token: undefined }),
  ).rejects.toThrow(/refresh_token がありません/);
  expect(fetchSpy).not.toHaveBeenCalled();
});
