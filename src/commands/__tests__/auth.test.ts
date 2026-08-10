import { stripVTControlCharacters } from "node:util";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TokenSet } from "../../auth/types.js";
import type { OAuthConfig } from "../../config/index.js";

/**
 * `esa auth status` の出力分岐を検証する。
 * token-store をモックして、保存済みトークンの有無を制御する。
 */

const loadTokens = vi.fn<() => TokenSet | null>();
const deleteTokens = vi.fn<() => Promise<void>>();
const revoke = vi.fn<() => Promise<void>>();
const refresh = vi.fn<() => Promise<TokenSet>>();
const login = vi.fn<(oauth: OAuthConfig) => Promise<TokenSet>>();

function mockTokenStore() {
  vi.doMock("../../auth/token-store.js", () => ({
    loadTokens,
    deleteTokens,
    getBackend: () => "keychain",
    backendLabel: () => "macOS Keychain",
  }));
  vi.doMock("../../auth/oauth.js", () => ({ login, revoke, refresh }));
}

/** status --json を実行して stdout の JSON を返す。 */
async function runStatus(
  fields = "auth_method,backend,token_type,scope,has_refresh_token,expired,expires_in_seconds",
): Promise<Record<string, unknown>> {
  const { registerAuthCommand } = await import("../auth.js");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);

  await program.parseAsync(["auth", "status", "--json", fields], {
    from: "user",
  });

  const output = log.mock.calls[0]?.[0] as string;
  return JSON.parse(output) as Record<string, unknown>;
}

/** status を実行し、装飾を外した人間向けの表示を返す。 */
async function runStatusOnTTY(): Promise<string> {
  const { registerAuthCommand } = await import("../auth.js");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;
  const program = new Command();
  registerAuthCommand(program);

  await program.parseAsync(["auth", "status"], { from: "user" });

  return stripVTControlCharacters(log.mock.calls[0]?.[0] as string);
}

async function runLogout(): Promise<void> {
  const { registerAuthCommand } = await import("../auth.js");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);
  await program.parseAsync(["auth", "logout"], { from: "user" });
}

const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  vi.resetModules();
  loadTokens.mockReset();
  deleteTokens.mockReset().mockResolvedValue();
  revoke.mockReset().mockResolvedValue();
  refresh.mockReset();
  login.mockReset().mockResolvedValue({
    access_token: "at",
    token_type: "Bearer",
    client_id: "cid",
  });
  mockTokenStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../../auth/token-store.js");
  vi.doUnmock("../../auth/oauth.js");
  process.stdout.isTTY = originalStdoutIsTTY;
  process.env.ESA_ACCESS_TOKEN = undefined;
  delete process.env.ESA_ACCESS_TOKEN;
  delete process.env.ESA_OAUTH_SCOPE;
});

describe("esa auth status", () => {
  test("reports none when there is no token at all", async () => {
    loadTokens.mockReturnValue(null);

    expect(await runStatus("auth_method")).toEqual({ auth_method: "none" });
  });

  test("reports the env token when ESA_ACCESS_TOKEN is set", async () => {
    loadTokens.mockReturnValue(null);
    process.env.ESA_ACCESS_TOKEN = "dummy";

    expect(await runStatus("auth_method,source")).toEqual({
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

describe("esa auth status on a TTY", () => {
  test("renders the stored token as a readable summary", async () => {
    loadTokens.mockReturnValue({
      access_token: "at",
      refresh_token: "rt",
      token_type: "Bearer",
      scope: "read:post write:post",
      // 単位の境界ちょうどだと、実行までの経過で表示が下の単位に落ちる。
      expires_at: Math.floor(Date.now() / 1000) + 3600 + 300,
      client_id: "cid",
    });

    expect(await runStatusOnTTY()).toBe(
      [
        "api.esa.io",
        "  ✓ Logged in to api.esa.io (macOS Keychain)",
        "  - Token scopes: 'read:post', 'write:post'",
        "  - Token expires: in 1 hour",
        "  - Refresh token: available",
      ].join("\n"),
    );
  });

  test("never prints the token itself", async () => {
    loadTokens.mockReturnValue({
      access_token: "super-secret-token",
      token_type: "Bearer",
      client_id: "cid",
    });

    const output = await runStatusOnTTY();

    expect(output).not.toContain("super-secret-token");
    expect(output).toContain("Refresh token: none");
  });

  test("calls out an expired token instead of showing a past time", async () => {
    loadTokens.mockReturnValue({
      access_token: "at",
      token_type: "Bearer",
      expires_at: Math.floor(Date.now() / 1000) - 10,
      client_id: "cid",
    });

    expect(await runStatusOnTTY()).toContain("Token expires: expired");
  });

  test("points at the login command when there is no token", async () => {
    loadTokens.mockReturnValue(null);

    expect(await runStatusOnTTY()).toBe(
      [
        "api.esa.io",
        "  X Not logged in to api.esa.io",
        "  - To log in, run: esa auth login",
      ].join("\n"),
    );
  });

  test("names ESA_ACCESS_TOKEN as the source when it is used", async () => {
    loadTokens.mockReturnValue(null);
    process.env.ESA_ACCESS_TOKEN = "dummy";

    expect(await runStatusOnTTY()).toContain(
      "✓ Logged in to api.esa.io (ESA_ACCESS_TOKEN)",
    );
  });
});

describe("esa auth login", () => {
  /** login を実行し、認可リクエストに載る scope を返す。 */
  async function runLogin(...args: string[]): Promise<string> {
    const { registerAuthCommand } = await import("../auth.js");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const program = new Command();
    registerAuthCommand(program);

    await program.parseAsync(["auth", "login", ...args], { from: "user" });

    return login.mock.calls[0]?.[0].scope as string;
  }

  test("requests every scope esa CLI uses by default", async () => {
    const scope = await runLogin();

    expect(scope.split(" ")).toEqual(
      expect.arrayContaining(["read:post", "write:post", "delete:post"]),
    );
  });

  test("requests only the given scopes", async () => {
    expect(await runLogin("--scopes", "read:post,read:comment")).toBe(
      "read:post read:comment",
    );
  });

  test("takes the scopes space-separated too, and folds duplicates", async () => {
    expect(await runLogin("-s", "write:post read:post write:post")).toBe(
      "write:post read:post",
    );
  });

  test("takes the singular --scope as an alias", async () => {
    expect(await runLogin("--scope", "read:post")).toBe("read:post");
  });

  test("passes through a scope it does not know (the server decides)", async () => {
    expect(await runLogin("--scopes", "admin:post")).toBe("admin:post");
  });

  test("--scopes wins over ESA_OAUTH_SCOPE", async () => {
    process.env.ESA_OAUTH_SCOPE = "read:team";

    expect(await runLogin("--scopes", "read:post")).toBe("read:post");
  });

  test.each([
    // 区切り忘れ。2 語とも action:resource の形になっていない。
    "read post",
    // resource だけ、action だけ、区切りが多いもの。
    "read:post,post",
    "read::post",
    // 空。
    " , ",
  ])(
    "rejects a malformed --scopes (%s) before opening the browser",
    async (scopes) => {
      await expect(runLogin("--scopes", scopes)).rejects.toThrow(/--scopes/);
      expect(login).not.toHaveBeenCalled();
    },
  );
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
    await program.parseAsync(
      [
        "auth",
        "refresh",
        "--json",
        "auth_method,backend,token_type,has_refresh_token,expires_in_seconds",
      ],
      { from: "user" },
    );
    return JSON.parse(log.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;
  }

  test("refresh writes nothing to stdout without --json", async () => {
    loadTokens.mockReturnValue(TOKENS);
    refresh.mockResolvedValue({
      access_token: "new-at",
      token_type: "Bearer",
      client_id: "cid",
    });
    const { registerAuthCommand } = await import("../auth.js");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const program = new Command();
    registerAuthCommand(program);

    await program.parseAsync(["auth", "refresh"], { from: "user" });

    // 新しいリソースは生まれないので stdout は空のまま（削除と同じ）。
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

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
    // status と揃ったスキーマ（auth_method / backend を含む）で出力する。
    expect(out).toMatchObject({
      auth_method: "oauth",
      backend: "keychain",
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
    ).rejects.toThrow(/not logged in with OAuth/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
