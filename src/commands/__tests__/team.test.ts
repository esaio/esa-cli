import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { captureStdout } from "../../test-utils/stdout.js";

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

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue(ok200({ teams: [], total_count: 0 }));
});

afterEach(() => {
  process.stdout.isTTY = originalStdoutIsTTY;
  vi.restoreAllMocks();
});

test("`esa team list` calls GET /v1/teams with an empty query by default", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = false;
  get.mockResolvedValue(
    ok200({
      teams: [{ name: "docs", description: "ドキュメント", privacy: "closed" }],
      total_count: 1,
    }),
  );

  await run(["team", "list"]);

  expect(get).toHaveBeenCalledWith("/v1/teams", { params: { query: {} } });
  expect(output()).toBe("docs\tドキュメント\tclosed\n");
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

test("passes an unknown --role value to the server for forward compatibility", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["team", "list", "--role", "bogus"]);

  expect(get).toHaveBeenCalledWith("/v1/teams", {
    params: { query: { role: "bogus" } },
  });
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
