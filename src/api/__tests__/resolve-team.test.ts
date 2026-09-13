import type { Client } from "openapi-fetch";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { FileConfigKey } from "../../config/file-store.js";
import type { paths } from "../../generated/api-types.js";

// i18n 初期化（言語判定）も同じ関数で language を読むので、mock は
// default_team を聞かれたときだけ値を返す。
const getConfigValue = vi.fn<(key: FileConfigKey) => string | undefined>();
vi.mock("../../config/file-store.js", () => ({ getConfigValue }));

function setConfiguredTeam(team: string | undefined): void {
  getConfigValue.mockImplementation((key) =>
    key === "default_team" ? team : undefined,
  );
}

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
  getConfigValue.mockReset();
  delete process.env.ESA_TEAM;
});

afterEach(() => {
  delete process.env.ESA_TEAM;
});

test("prefers the --team flag over everything", async () => {
  process.env.ESA_TEAM = "env-team";
  setConfiguredTeam("config-team");
  const { client, get } = makeClient(["a", "b"]);

  expect(await resolveTeam(client, "flag-team")).toBe("flag-team");
  expect(get).not.toHaveBeenCalled();
});

test("falls back to ESA_TEAM when no flag is given", async () => {
  process.env.ESA_TEAM = "env-team";
  setConfiguredTeam("config-team");
  const { client } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("env-team");
});

test("falls back to the configured default team", async () => {
  setConfiguredTeam("config-team");
  const { client, get } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("config-team");
  expect(get).not.toHaveBeenCalled();
});

test("auto-selects the only team when nothing else is set", async () => {
  setConfiguredTeam(undefined);
  const { client } = makeClient(["only-team"]);

  expect(await resolveTeam(client)).toBe("only-team");
});

test("errors when there are multiple teams and none is chosen", async () => {
  setConfiguredTeam(undefined);
  const { client } = makeClient(["a", "b"]);

  await expect(resolveTeam(client)).rejects.toThrow(/multiple teams/);
});

test("errors when the user belongs to no team", async () => {
  setConfiguredTeam(undefined);
  const { client } = makeClient([]);

  await expect(resolveTeam(client)).rejects.toThrow(
    /do not belong to any team/,
  );
});

test("propagates a 401 from GET /v1/teams instead of swallowing it", async () => {
  // ローカル判定に頼らず、認証エラーは握りつぶさず伝える
  // （「所属チームなし」に化けさせない）。unwrap の 401 メッセージが届くこと。
  setConfiguredTeam(undefined);
  const { client } = makeClient([], 401);

  await expect(resolveTeam(client)).rejects.toThrow(/Authentication failed/);
});

test("points at --team when the token lacks read:team", async () => {
  // 所属チームの問い合わせは read:team を使うが、チームが分かっていれば要らない。
  // スコープを足し直すより先に、直接指定する道を案内する。
  setConfiguredTeam(undefined);
  const { client } = makeClient([], 403);

  await expect(resolveTeam(client)).rejects.toThrow(/--team/);
});

test("ignores a whitespace-only ESA_TEAM and falls through", async () => {
  // trim して空になる値は未指定として扱う。
  process.env.ESA_TEAM = "  ";
  setConfiguredTeam("config-team");
  const { client } = makeClient(["a", "b"]);

  expect(await resolveTeam(client)).toBe("config-team");
});
