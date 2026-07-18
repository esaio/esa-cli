import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ResolvedAuth } from "../../auth/resolve-auth.js";

const refresh = vi.fn();
const resolveAuth = vi.fn<() => ResolvedAuth>();

vi.mock("../../auth/oauth.js", () => ({ refresh }));
vi.mock("../../auth/resolve-auth.js", () => ({ resolveAuth }));
vi.mock("../../config/index.js", () => ({
  getOAuthConfig: () => ({
    clientId: "cid",
    scope: "read:post",
    apiBaseUrl: "https://api.esa.io",
  }),
}));

const { createEsaClient } = await import("../client.js");

const OAUTH: ResolvedAuth = {
  method: "oauth",
  tokens: { access_token: "old", token_type: "Bearer", client_id: "cid" },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  refresh.mockReset().mockResolvedValue(undefined);
  resolveAuth.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sends a Bearer token from the resolved auth", async () => {
  resolveAuth.mockReturnValue(OAUTH);
  const fetchMock = vi.fn(async (_input: Request) =>
    json({ myself: true }, 200),
  );
  vi.stubGlobal("fetch", fetchMock);

  await createEsaClient().GET("/v1/user");

  const request = fetchMock.mock.calls[0][0];
  expect(request.headers.get("Authorization")).toBe("Bearer old");
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

test("refreshes once and retries on 401 for OAuth", async () => {
  resolveAuth.mockReturnValue(OAUTH);
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ message: "unauthorized" }, 401))
    .mockResolvedValueOnce(json({ myself: true }, 200));
  vi.stubGlobal("fetch", fetchMock);

  const { data, response } = await createEsaClient().GET("/v1/user");

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(response.status).toBe(200);
  expect(data).toEqual({ myself: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
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
  resolveAuth.mockReturnValue(OAUTH);
  refresh.mockRejectedValue(new Error("refresh failed"));
  const fetchMock = vi.fn(async () => json({ message: "unauthorized" }, 401));
  vi.stubGlobal("fetch", fetchMock);

  const { response } = await createEsaClient().GET("/v1/user");

  expect(response.status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
