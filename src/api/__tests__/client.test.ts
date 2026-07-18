import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ResolvedAuth } from "../../auth/resolve-auth.js";

const refresh = vi.fn();
const resolveAuth = vi.fn<() => ResolvedAuth>();
const getOAuthConfig = vi.fn(() => ({
  clientId: "cid",
  scope: "read:post",
  apiBaseUrl: "https://api.esa.io",
}));

vi.mock("../../auth/oauth.js", () => ({ refresh }));
vi.mock("../../auth/resolve-auth.js", () => ({ resolveAuth }));
vi.mock("../../config/index.js", () => ({
  config: { cli: { name: "esa", description: "", version: "9.9.9" } },
  getOAuthConfig,
}));

const { createEsaClient } = await import("../client.js");

const oauth = (accessToken: string): ResolvedAuth => ({
  method: "oauth",
  tokens: { access_token: accessToken, token_type: "Bearer", client_id: "cid" },
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  refresh.mockReset().mockResolvedValue(undefined);
  resolveAuth.mockReset();
  getOAuthConfig.mockReset().mockReturnValue({
    clientId: "cid",
    scope: "read:post",
    apiBaseUrl: "https://api.esa.io",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sends the Bearer token and esa-cli User-Agent", async () => {
  resolveAuth.mockReturnValue(oauth("old"));
  const fetchMock = vi.fn(async (_input: Request) =>
    json({ myself: true }, 200),
  );
  vi.stubGlobal("fetch", fetchMock);

  await createEsaClient().GET("/v1/user");

  const request = fetchMock.mock.calls[0][0];
  expect(request.headers.get("Authorization")).toBe("Bearer old");
  expect(request.headers.get("User-Agent")).toBe("esa-cli/9.9.9 (official)");
});

test("throws when there is no auth", async () => {
  resolveAuth.mockReturnValue({ method: "none" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({}, 200)),
  );

  await expect(createEsaClient().GET("/v1/user")).rejects.toThrow(
    /認証情報がありません/,
  );
});

test("refreshes on 401 and retries with the new token", async () => {
  // refresh 後は新しいトークンを返すようにして、リトライにそれが載ることを検証する。
  let refreshed = false;
  refresh.mockImplementation(async () => {
    refreshed = true;
  });
  resolveAuth.mockImplementation(() => oauth(refreshed ? "new" : "old"));
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ message: "unauthorized" }, 401))
    .mockResolvedValueOnce(json({ myself: true }, 200));
  vi.stubGlobal("fetch", fetchMock);

  const { data, response } = await createEsaClient().GET("/v1/user");

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(200);
  expect(data).toEqual({ myself: true });
  // リトライ（2回目）に refresh 後の新トークンが載っていること。
  const retry = fetchMock.mock.calls[1][0] as Request;
  expect(retry.headers.get("Authorization")).toBe("Bearer new");
});

test("retries at most once and converges when 401 persists", async () => {
  resolveAuth.mockReturnValue(oauth("old"));
  const fetchMock = vi.fn(async () => json({ message: "unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);

  const { response } = await createEsaClient().GET("/v1/user");

  expect(response.status).toBe(401);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2); // 1 回だけリトライして収束
});

test("does not refresh on 401 for env token", async () => {
  resolveAuth.mockReturnValue({ method: "env", token: "env-token" });
  const fetchMock = vi.fn(async () => json({ message: "unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);

  const { response } = await createEsaClient().GET("/v1/user");

  expect(refresh).not.toHaveBeenCalled();
  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("returns the original 401 when refresh fails", async () => {
  resolveAuth.mockReturnValue(oauth("old"));
  refresh.mockRejectedValue(new Error("refresh failed"));
  const fetchMock = vi.fn(async () => json({ message: "unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);

  const { response } = await createEsaClient().GET("/v1/user");

  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("wraps a network failure in a friendly error", async () => {
  resolveAuth.mockReturnValue(oauth("old"));
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

test("rejects a non-HTTPS external base URL before sending", () => {
  getOAuthConfig.mockReturnValue({
    clientId: "cid",
    scope: "read:post",
    apiBaseUrl: "http://evil.example.com",
  });

  expect(() => createEsaClient()).toThrow(/HTTPS/);
});

test("allows http on localhost for local development", () => {
  getOAuthConfig.mockReturnValue({
    clientId: "cid",
    scope: "read:post",
    apiBaseUrl: "http://localhost:3000",
  });

  expect(() => createEsaClient()).not.toThrow();
});
