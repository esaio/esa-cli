import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));

const { registerPostCommand } = await import("../post.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerPostCommand(program);
  return program.parseAsync(args, { from: "user" });
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({
    data: { posts: [], total_count: 0 },
    response: new Response(null, { status: 200 }),
  });
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`post list` resolves the team and calls GET with the team path", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "post",
    "list",
    "--team",
    "docs",
    "--per-page",
    "5",
    "-q",
    "wip:true",
  ]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: {
      path: { team_name: "resolved-team" },
      query: { per_page: 5, q: "wip:true" },
    },
  });
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    posts: [],
    total_count: 0,
  });
});

test("`post list` passes --page as a number in the query", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "list", "--page", "2"]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: { path: { team_name: "resolved-team" }, query: { page: 2 } },
  });
});

test("`post list` rejects an invalid --page before any network call", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["post", "list", "--page", "abc"])).rejects.toThrow(
    /--page.*整数/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`post get` calls GET with the post number in the path", async () => {
  get.mockResolvedValue({
    data: { number: 123, name: "hi" },
    response: new Response(null, { status: 200 }),
  });
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "get", "123"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    { params: { path: { team_name: "resolved-team", post_number: 123 } } },
  );
});

test("`post get` rejects a non-numeric post number before any network call", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["post", "get", "abc"])).rejects.toThrow(/number.*整数/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});
