import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TokenSet } from "../types.js";

const loadTokens = vi.fn<() => TokenSet | null>();
vi.mock("../token-store.js", () => ({ loadTokens }));

const { resolveAuth } = await import("../resolve-auth.js");

const TOKENS: TokenSet = {
  access_token: "at",
  token_type: "Bearer",
  client_id: "cid",
};

beforeEach(() => {
  loadTokens.mockReset();
  delete process.env.ESA_ACCESS_TOKEN;
});

afterEach(() => {
  delete process.env.ESA_ACCESS_TOKEN;
});

test("prefers the stored OAuth token over the env token", () => {
  loadTokens.mockReturnValue(TOKENS);
  process.env.ESA_ACCESS_TOKEN = "env-token";

  expect(resolveAuth()).toEqual({ method: "oauth", tokens: TOKENS });
});

test("falls back to ESA_ACCESS_TOKEN when there is no OAuth token", () => {
  loadTokens.mockReturnValue(null);
  process.env.ESA_ACCESS_TOKEN = "env-token";

  expect(resolveAuth()).toEqual({ method: "env", token: "env-token" });
});

test("returns none when neither is present", () => {
  loadTokens.mockReturnValue(null);

  expect(resolveAuth()).toEqual({ method: "none" });
});
