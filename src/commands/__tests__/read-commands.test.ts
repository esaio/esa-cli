import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));

const { registerCategoryCommand } = await import("../category.js");
const { registerTagCommand } = await import("../tag.js");
const { registerMemberCommand } = await import("../member.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerCategoryCommand(program);
  registerTagCommand(program);
  registerMemberCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok200({ ok: true }));
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`tag list` resolves the team and calls the tags endpoint", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["tag", "list", "--team", "docs", "--per-page", "50"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/tags", {
    params: { path: { team_name: "resolved-team" }, query: { per_page: 50 } },
  });
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ ok: true });
});

test("`tag list` rejects an invalid --page before any network call", async () => {
  await expect(run(["tag", "list", "--page", "abc"])).rejects.toThrow(
    /--page.*positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`category list` always sends v=2 and passes the path filters", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "category",
    "list",
    "--prefix",
    "dev/",
    "--match",
    "docs",
    "--exact-match",
    "dev/docs",
  ]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/categories/paths", {
    params: {
      path: { team_name: "resolved-team" },
      query: { v: 2, prefix: "dev/", match: "docs", exact_match: "dev/docs" },
    },
  });
});

test("`category list --page` returns just that page (v=2)", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["category", "list", "--page", "2"]);

  expect(get.mock.calls[0][1].params.query).toEqual({ v: 2, page: 2 });
});

test("`category list --all` walks every page and combines the results", async () => {
  get
    .mockResolvedValueOnce(
      ok200({ categories: [{ full_name: "a" }], next_page: 2, total_count: 2 }),
    )
    .mockResolvedValueOnce(
      ok200({
        categories: [{ full_name: "b" }],
        next_page: null,
        total_count: 2,
      }),
    );
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["category", "list", "--all"]);

  expect(get).toHaveBeenCalledTimes(2);
  expect(get.mock.calls[0][1].params.query).toEqual({
    v: 2,
    per_page: 100,
    page: 1,
  });
  expect(get.mock.calls[1][1].params.query).toEqual({
    v: 2,
    per_page: 100,
    page: 2,
  });
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    categories: [{ full_name: "a" }, { full_name: "b" }],
    total_count: 2,
  });
});

test("`category list --all --page` is rejected before any network call", async () => {
  await expect(
    run(["category", "list", "--all", "--page", "2"]),
  ).rejects.toThrow(/Cannot use --all/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`member list` passes valid sort and order through", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["member", "list", "--sort", "posts_count", "--order", "asc"]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/members", {
    params: {
      path: { team_name: "resolved-team" },
      query: { sort: "posts_count", order: "asc" },
    },
  });
});

test("`member list` ignores an invalid --sort value", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["member", "list", "--sort", "bogus"]);

  expect(get.mock.calls[0][1].params.query).toEqual({});
});
