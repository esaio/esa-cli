import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ResolvedAuth } from "../../auth/resolve-auth.js";
import type { TokenSet } from "../../auth/types.js";

const refresh = vi.fn<() => Promise<TokenSet>>();
const resolveAuth = vi.fn<() => ResolvedAuth>();
const getOAuthConfig = vi.fn(() => ({
  clientId: "cid",
  scope: "read:post",
  apiBaseUrl: "https://api.esa.io",
}));

vi.mock("../../auth/oauth.js", () => ({ refresh }));
vi.mock("../../auth/resolve-auth.js", () => ({ resolveAuth }));
vi.mock("../../config/index.js", () => ({
  config: {
    cli: {
      name: "esa",
      description: "",
      version: "9.9.9",
      userAgent: "esa-cli/9.9.9 (official)",
    },
  },
  getOAuthConfig,
}));

const { createEsaClient } = await import("../client.js");

const NOW = () => Math.floor(Date.now() / 1000);

/** expiresAt を省くと期限不明のトークン。 */
function oauth(accessToken: string, expiresAt?: number): ResolvedAuth {
  return {
    method: "oauth",
    tokens: {
      access_token: accessToken,
      token_type: "Bearer",
      client_id: "cid",
      expires_at: expiresAt,
    },
  };
}

/** refresh() の戻り値（更新後トークン）。 */
function tokenSet(accessToken: string, expiresAt: number): TokenSet {
  return {
    access_token: accessToken,
    token_type: "Bearer",
    client_id: "cid",
    expires_at: expiresAt,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubOkFetch() {
  const fetchMock = vi.fn(async (_input: Request) =>
    json({ myself: true }, 200),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentAuthHeader(
  fetchMock: ReturnType<typeof stubOkFetch>,
): string | null {
  return fetchMock.mock.calls[0][0].headers.get("Authorization");
}

beforeEach(() => {
  refresh.mockReset();
  resolveAuth.mockReset();
  getOAuthConfig.mockReset().mockReturnValue({
    clientId: "cid",
    scope: "read:post",
    apiBaseUrl: "https://api.esa.io",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("sends the Bearer token and esa-cli User-Agent", async () => {
  resolveAuth.mockReturnValue(oauth("tok", NOW() + 3600));
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  const request = fetchMock.mock.calls[0][0];
  expect(request.headers.get("Authorization")).toBe("Bearer tok");
  expect(request.headers.get("User-Agent")).toBe("esa-cli/9.9.9 (official)");
});

test("throws when there is no auth", async () => {
  resolveAuth.mockReturnValue({ method: "none" });
  stubOkFetch();

  await expect(createEsaClient().GET("/v1/user")).rejects.toThrow(
    /認証情報がありません/,
  );
});

test("refreshes before sending when the token is about to expire", async () => {
  resolveAuth.mockReturnValue(oauth("old", NOW() + 30)); // マージン内
  refresh.mockResolvedValue(tokenSet("new", NOW() + 7200));
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(sentAuthHeader(fetchMock)).toBe("Bearer new"); // refresh の戻り値を使う
});

test("treats the margin boundary (exactly 60s) as expiring", async () => {
  // Date.now を固定して <=（境界含む）を検証する。
  const nowSec = 1_700_000_000;
  vi.spyOn(Date, "now").mockReturnValue(nowSec * 1000);
  resolveAuth.mockReturnValue(oauth("old", nowSec + 60));
  refresh.mockResolvedValue(tokenSet("new", nowSec + 7200));
  stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).toHaveBeenCalledTimes(1);
});

test("does not refresh one second past the margin (61s)", async () => {
  const nowSec = 1_700_000_000;
  vi.spyOn(Date, "now").mockReturnValue(nowSec * 1000);
  resolveAuth.mockReturnValue(oauth("old", nowSec + 61));
  stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).not.toHaveBeenCalled();
});

test("does not refresh when the token is still valid", async () => {
  resolveAuth.mockReturnValue(oauth("tok", NOW() + 3600));
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).not.toHaveBeenCalled();
  expect(sentAuthHeader(fetchMock)).toBe("Bearer tok");
});

test("does not refresh when the expiry is unknown", async () => {
  resolveAuth.mockReturnValue(oauth("tok")); // expires_at 無し
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).not.toHaveBeenCalled();
  expect(sentAuthHeader(fetchMock)).toBe("Bearer tok");
});

test("uses the env token without refreshing", async () => {
  resolveAuth.mockReturnValue({ method: "env", token: "env-token" });
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).not.toHaveBeenCalled();
  expect(sentAuthHeader(fetchMock)).toBe("Bearer env-token");
});

test("still sends with the current token if the proactive refresh fails", async () => {
  resolveAuth.mockReturnValue(oauth("old", NOW() + 30));
  refresh.mockRejectedValue(new Error("network down"));
  const fetchMock = stubOkFetch();

  await createEsaClient().GET("/v1/user");

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(sentAuthHeader(fetchMock)).toBe("Bearer old");
});

test("passes a 401 response through without retrying", async () => {
  // ローカル判定が外れてサーバーが 401 を返しても、リトライせず 401 を返す。
  resolveAuth.mockReturnValue(oauth("tok", NOW() + 3600));
  const fetchMock = vi.fn(async () => json({ message: "unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);

  const { response } = await createEsaClient().GET("/v1/user");

  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});

test("wraps a network failure in a friendly error", async () => {
  resolveAuth.mockReturnValue(oauth("tok", NOW() + 3600));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("fetch failed");
    }),
  );

  await expect(createEsaClient().GET("/v1/user")).rejects.toThrow(
    /接続に失敗しました/,
  );
});
