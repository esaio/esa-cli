import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get }),
}));

const { registerTeamCommand } = await import("../team.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  registerTeamCommand(program);
  return program.parseAsync(args, { from: "user" });
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({
    data: { teams: [], total_count: 0 },
    response: new Response(null, { status: 200 }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`esa team list` calls GET /v1/teams with an empty query by default", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["team", "list"]);

  expect(get).toHaveBeenCalledWith("/v1/teams", { params: { query: {} } });
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    teams: [],
    total_count: 0,
  });
});

test("passes --page / --per-page as numbers and a valid --role", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "team",
    "list",
    "--page",
    "2",
    "--per-page",
    "5",
    "--role",
    "owner",
  ]);

  expect(get).toHaveBeenCalledWith("/v1/teams", {
    params: { query: { page: 2, per_page: 5, role: "owner" } },
  });
});

test("ignores an invalid --role value", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["team", "list", "--role", "bogus"]);

  expect(get).toHaveBeenCalledWith("/v1/teams", { params: { query: {} } });
});

test("rejects a non-numeric --page without calling the API", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["team", "list", "--page", "abc"])).rejects.toThrow(
    /--page.*positive integer/,
  );
  expect(get).not.toHaveBeenCalled();
});

test("rejects --page 0 (must be >= 1)", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["team", "list", "--page", "0"])).rejects.toThrow(
    /--page.*positive integer/,
  );
  expect(get).not.toHaveBeenCalled();
});

test("rejects a negative --per-page", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["team", "list", "--per-page", "-1"])).rejects.toThrow(
    /--per-page.*positive integer/,
  );
  expect(get).not.toHaveBeenCalled();
});
