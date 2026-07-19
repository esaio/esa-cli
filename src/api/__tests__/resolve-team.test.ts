import type { Client } from "openapi-fetch";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { paths } from "../../generated/api-types.js";

const getDefaultTeam = vi.fn<() => string | undefined>();
vi.mock("../../config/file-store.js", () => ({ getDefaultTeam }));

const { resolveTeam } = await import("../resolve-team.js");

/** GET /v1/teams のレスポンスを差し替えたダミー client。 */
function makeClient(names: string[], status = 200) {
  const get = vi.fn(async () => ({
    data:
      status === 200 ? { teams: names.map((name) => ({ name })) } : undefined,
    response: new Response(null, { status }),
  }));
  const client = { GET: get } as unknown as Client<paths>;
  return { client, get };
}

beforeEach(() => {
  getDefaultTeam.mockReset();
  delete process.env.ESA_TEAM;
});

afterEach(() => {
  delete process.env.ESA_TEAM;
});

test("prefers the --team flag over everything", async () => {
  process.env.ESA_TEAM = "env-team";
  getDefaultTeam.mockReturnValue("config-team");
  const { client, get } = makeClient(["a", "b"]);

  expect(await resolveTeam(client, "flag-team")).toBe("flag-team");
  expect(get).not.toHaveBeenCalled();
});

test("falls back to ESA_TEAM when no flag is given", async () => {
  process.env.ESA_TEAM = "env-team";
  getDefaultTeam.mockReturnValue("config-team");
  const { client } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("env-team");
});

test("falls back to the configured default team", async () => {
  getDefaultTeam.mockReturnValue("config-team");
  const { client, get } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("config-team");
  expect(get).not.toHaveBeenCalled();
});

test("auto-selects the only team when nothing else is set", async () => {
  getDefaultTeam.mockReturnValue(undefined);
  const { client } = makeClient(["only-team"]);

  expect(await resolveTeam(client)).toBe("only-team");
});

test("errors when there are multiple teams and none is chosen", async () => {
  getDefaultTeam.mockReturnValue(undefined);
  const { client } = makeClient(["a", "b"]);

  await expect(resolveTeam(client)).rejects.toThrow(/複数のチーム/);
});

test("errors when the user belongs to no team", async () => {
  getDefaultTeam.mockReturnValue(undefined);
  const { client } = makeClient([]);

  await expect(resolveTeam(client)).rejects.toThrow(
    /所属しているチームがありません/,
  );
});

test("propagates a 401 from GET /v1/teams instead of swallowing it", async () => {
  // ローカル判定に頼らず、認証エラーは握りつぶさず伝える
  // （「所属チームなし」に化けさせない）。unwrap の 401 メッセージが届くこと。
  getDefaultTeam.mockReturnValue(undefined);
  const { client } = makeClient([], 401);

  await expect(resolveTeam(client)).rejects.toThrow(/認証に失敗しました/);
});

test("ignores a whitespace-only ESA_TEAM and falls through", async () => {
  // trim して空になる値は未指定として扱う。
  process.env.ESA_TEAM = "  ";
  getDefaultTeam.mockReturnValue("config-team");
  const { client } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("config-team");
});
