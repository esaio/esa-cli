import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TokenSet } from "../../auth/types.js";

/**
 * `esa auth status` の出力分岐を検証する。
 * token-store をモックして、保存済みトークンの有無を制御する。
 */

const loadTokens = vi.fn<() => TokenSet | null>();
const deleteTokens = vi.fn<() => Promise<void>>();
const revoke = vi.fn<() => Promise<void>>();
const refresh = vi.fn<() => Promise<TokenSet>>();

function mockTokenStore() {
  vi.doMock("../../auth/token-store.js", () => ({
    loadTokens,
    deleteTokens,
    getBackend: () => "keychain",
    backendLabel: () => "macOS Keychain",
  }));
  vi.doMock("../../auth/oauth.js", () => ({ revoke, refresh }));
}

/** status を実行して stdout に出力された JSON を返す。 */
async function runStatus(): Promise<Record<string, unknown>> {
  const { registerAuthCommand } = await import("../auth.js");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);

  await program.parseAsync(["auth", "status"], { from: "user" });

  const output = log.mock.calls[0]?.[0] as string;
  return JSON.parse(output) as Record<string, unknown>;
}

async function runLogout(): Promise<void> {
  const { registerAuthCommand } = await import("../auth.js");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);
  await program.parseAsync(["auth", "logout"], { from: "user" });
}

beforeEach(() => {
  vi.resetModules();
  loadTokens.mockReset();
  deleteTokens.mockReset().mockResolvedValue();
  revoke.mockReset().mockResolvedValue();
  refresh.mockReset();
  mockTokenStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../../auth/token-store.js");
  vi.doUnmock("../../auth/oauth.js");
  process.env.ESA_ACCESS_TOKEN = undefined;
  delete process.env.ESA_ACCESS_TOKEN;
});

describe("esa auth status", () => {
  test("reports none when there is no token at all", async () => {
    loadTokens.mockReturnValue(null);

    expect(await runStatus()).toEqual({ auth_method: "none" });
  });

  test("reports the env token when ESA_ACCESS_TOKEN is set", async () => {
    loadTokens.mockReturnValue(null);
    process.env.ESA_ACCESS_TOKEN = "dummy";

    expect(await runStatus()).toEqual({
      auth_method: "env",
      source: "ESA_ACCESS_TOKEN",
    });
  });

  test("reports oauth details for a valid stored token", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    loadTokens.mockReturnValue({
      access_token: "at",
      refresh_token: "rt",
      token_type: "Bearer",
      scope: "read:post",
      expires_at: future,
      client_id: "cid",
    });

    const status = await runStatus();

    expect(status).toMatchObject({
      auth_method: "oauth",
      backend: "keychain",
      token_type: "Bearer",
      scope: "read:post",
      has_refresh_token: true,
      expired: false,
    });
    expect(status.expires_in_seconds).toBeGreaterThan(0);
  });

  test("marks an expired token as expired", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    loadTokens.mockReturnValue({
      access_token: "at",
      token_type: "Bearer",
      expires_at: past,
      client_id: "cid",
    });

    expect(await runStatus()).toMatchObject({
      expired: true,
      expires_in_seconds: 0,
      has_refresh_token: false,
    });
  });

  test("reports null expiry (not 0) when expires_at is unknown", async () => {
    loadTokens.mockReturnValue({
      access_token: "at",
      token_type: "Bearer",
      client_id: "cid",
    });

    // 期限不明を「期限切れ0秒」と混同しないよう、両方 null にする。
    expect(await runStatus()).toMatchObject({
      expired: null,
      expires_in_seconds: null,
    });
  });
});

describe("esa auth logout", () => {
  const TOKENS: TokenSet = {
    access_token: "at",
    refresh_token: "rt",
    token_type: "Bearer",
    client_id: "cid",
  };

  test("deletes the local token after a successful revoke", async () => {
    loadTokens.mockReturnValue(TOKENS);

    await runLogout();

    expect(revoke).toHaveBeenCalled();
    expect(deleteTokens).toHaveBeenCalled();
  });

  test("still deletes the local token when revoke fails (e.g. offline)", async () => {
    loadTokens.mockReturnValue(TOKENS);
    revoke.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    await runLogout();

    expect(deleteTokens).toHaveBeenCalled();
  });

  test("still tries to delete when the stored token is unreadable (null)", async () => {
    // loadTokens はパース失敗時も null を返すため、壊れたデータが残っている
    // 可能性がある。revoke は無理でも削除は試みる。
    loadTokens.mockReturnValue(null);

    await runLogout();

    expect(revoke).not.toHaveBeenCalled();
    expect(deleteTokens).toHaveBeenCalled();
  });
});

describe("esa auth refresh", () => {
  const TOKENS: TokenSet = {
    access_token: "at",
    refresh_token: "rt",
    token_type: "Bearer",
    client_id: "cid",
  };

  async function runRefresh(): Promise<Record<string, unknown>> {
    const { registerAuthCommand } = await import("../auth.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const program = new Command();
    program.exitOverride();
    registerAuthCommand(program);
    await program.parseAsync(["auth", "refresh"], { from: "user" });
    return JSON.parse(log.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
  }

  test("refreshes the OAuth token and prints the new expiry", async () => {
    loadTokens.mockReturnValue(TOKENS);
    const future = Math.floor(Date.now() / 1000) + 7200;
    refresh.mockResolvedValue({
      access_token: "new-at",
      refresh_token: "new-rt",
      token_type: "Bearer",
      scope: "read:post",
      expires_at: future,
      client_id: "cid",
    });

    const out = await runRefresh();

    expect(refresh).toHaveBeenCalled();
    expect(out).toMatchObject({
      token_type: "Bearer",
      has_refresh_token: true,
    });
    expect(out.expires_in_seconds).toBeGreaterThan(0);
  });

  test("errors when not logged in via OAuth", async () => {
    loadTokens.mockReturnValue(null);
    const { registerAuthCommand } = await import("../auth.js");
    const program = new Command();
    program.exitOverride();
    registerAuthCommand(program);

    await expect(
      program.parseAsync(["auth", "refresh"], { from: "user" }),
    ).rejects.toThrow(/OAuth でログインしていません/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
