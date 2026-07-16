import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TokenSet } from "../auth/types.js";

/**
 * `esa auth status` の出力分岐を検証する。
 * token-store をモックして、保存済みトークンの有無を制御する。
 */

const loadTokens = vi.fn<() => TokenSet | null>();

function mockTokenStore() {
  vi.doMock("../auth/token-store.js", () => ({
    loadTokens,
    deleteTokens: vi.fn(),
    getBackend: () => "keychain",
    backendLabel: () => "macOS Keychain",
  }));
}

/** status を実行して stdout に出力された JSON を返す。 */
async function runStatus(): Promise<Record<string, unknown>> {
  const { registerAuthCommand } = await import("../commands/auth.js");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);

  await program.parseAsync(["auth", "status"], { from: "user" });

  const output = log.mock.calls[0]?.[0] as string;
  return JSON.parse(output) as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetModules();
  loadTokens.mockReset();
  mockTokenStore();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("../auth/token-store.js");
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
});
