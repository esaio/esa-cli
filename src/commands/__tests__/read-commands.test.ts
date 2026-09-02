import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { captureStdout } from "../../test-utils/stdout.js";

const get = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));

const { registerCategoryCommand } = await import("../category.js");
const { registerTagCommand } = await import("../tag.js");
const { registerMemberCommand } = await import("../member.js");
const { registerTeamCommand } = await import("../team.js");
const { registerPostCommand } = await import("../post.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerCategoryCommand(program);
  registerTagCommand(program);
  registerMemberCommand(program);
  registerTeamCommand(program);
  registerPostCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

/** member view の応答。表示に使う項目がすべて埋まっている最小の Member。 */
const memberFixture = {
  screen_name: "ppworks",
  name: "Koshikawa Naoto",
  email: "ppworks@example.com",
  role: "owner",
  posts_count: 3330,
  joined_at: "2020-01-01T00:00:00+09:00",
  last_accessed_at: "2026-07-27T09:03:16+09:00",
};

const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok200({ ok: true }));
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
  // 既定はパイプ扱いにして、テーブル整形ではなくタブ区切りを検証する。
  process.stdout.isTTY = false;
});

afterEach(() => {
  process.stdout.isTTY = originalStdoutIsTTY;
  vi.restoreAllMocks();
});

test("`tag list` resolves the team and calls the tags endpoint", async () => {
  const { output } = captureStdout();
  get.mockResolvedValue(
    ok200({ tags: [{ name: "設計", posts_count: 12 }], total_count: 1 }),
  );

  await run(["tag", "list", "--team", "docs", "--per-page", "50"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/tags", {
    params: { path: { team_name: "resolved-team" }, query: { per_page: 50 } },
  });
  expect(output()).toBe("設計\t12\n");
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
      ok200({
        categories: [{ path: "a", posts: 1 }],
        next_page: 2,
        total_count: 2,
      }),
    )
    .mockResolvedValueOnce(
      ok200({
        categories: [{ path: "b", posts: 2 }],
        next_page: null,
        total_count: 2,
      }),
    );
  const { output } = captureStdout();

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
  // 全ページ分がひとつの表にまとまる。
  expect(output()).toBe("a\t1\nb\t2\n");
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

test("`member list` renders the member columns", async () => {
  const { output } = captureStdout();
  get.mockResolvedValue(
    ok200({
      members: [
        {
          screen_name: "ppworks",
          name: "Koshikawa Naoto",
          email: "ppworks@example.com",
          role: "owner",
          posts_count: 3330,
          last_accessed_at: "2026-07-27T09:03:16+09:00",
        },
      ],
      total_count: 1,
    }),
  );

  await run(["member", "list"]);

  // screen_name と name を取り違えないことを、値の並びで確かめる。
  expect(output()).toBe(
    "ppworks\tKoshikawa Naoto\tppworks@example.com\towner\t3330\t2026-07-27T09:03:16+09:00\n",
  );
});

test("`member list` leaves the email column empty when email is null", async () => {
  const { output } = captureStdout();
  // 子チームに有効な id_provider が無いと email は null で返る。
  get.mockResolvedValue(
    ok200({
      members: [
        {
          screen_name: "ppworks",
          name: "Koshikawa Naoto",
          email: null,
          role: "member",
          posts_count: 1,
          last_accessed_at: "2026-07-27T09:03:16+09:00",
        },
      ],
      total_count: 1,
    }),
  );

  await run(["member", "list", "--child-team", "child"]);

  expect(output()).toBe(
    "ppworks\tKoshikawa Naoto\t\tmember\t1\t2026-07-27T09:03:16+09:00\n",
  );
});

test("`member list --child-team` lists the child team's members", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["member", "list", "--child-team", "child", "--per-page", "50"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), undefined);
  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/child_teams/{child_team_name}/members",
    {
      params: {
        path: { team_name: "resolved-team", child_team_name: "child" },
        query: { per_page: 50 },
      },
    },
  );
});

test("`member list --child-team` rejects --sort / --order before any network call", async () => {
  await expect(
    run(["member", "list", "--child-team", "child", "--sort", "joined"]),
  ).rejects.toThrow(/--sort/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`member list` rejects an empty --child-team before any network call", async () => {
  await expect(run(["member", "list", "--child-team", "  "])).rejects.toThrow(
    /--child-team/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`member view` reads a member of the resolved team", async () => {
  get.mockResolvedValue(ok200(memberFixture));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["member", "view", "ppworks"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/members/{screen_name_or_email}",
    {
      params: {
        path: { team_name: "resolved-team", screen_name_or_email: "ppworks" },
      },
    },
  );
  expect((log.mock.calls[0][0] as string).split("\n")).toEqual([
    "screen_name\tppworks",
    "email\tppworks@example.com",
    "role\towner",
    "posts_count\t3330",
    "joined_at\t2020-01-01T00:00:00+09:00",
    "last_accessed_at\t2026-07-27T09:03:16+09:00",
  ]);
});

test("`member view --child-team` reads a member of the child team", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  get.mockResolvedValue(ok200(memberFixture));

  await run([
    "member",
    "view",
    "someone@example.com",
    "--child-team",
    "child",
    "--team",
    "parent",
  ]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "parent");
  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/child_teams/{child_team_name}/members/{screen_name_or_email}",
    {
      params: {
        path: {
          team_name: "resolved-team",
          child_team_name: "child",
          screen_name_or_email: "someone@example.com",
        },
      },
    },
  );
});

test("`member get` is an alias for `member view`", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  get.mockResolvedValue(ok200(memberFixture));

  await run(["member", "get", "ppworks"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/members/{screen_name_or_email}",
    expect.anything(),
  );
});

test("`team children` lists the child teams with the team columns", async () => {
  const { output } = captureStdout();
  get.mockResolvedValue(
    ok200({
      teams: [{ name: "child", description: "子チーム", privacy: "closed" }],
      total_count: 1,
    }),
  );

  await run(["team", "children", "--team", "parent", "--page", "2"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "parent");
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/child_teams", {
    params: { path: { team_name: "resolved-team" }, query: { page: 2 } },
  });
  expect(output()).toBe("child\t子チーム\tclosed\n");
});

test("`team children` rejects an invalid --page before any network call", async () => {
  await expect(run(["team", "children", "--page", "0"])).rejects.toThrow(
    /--page/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`member list` passes unknown enum values through to the server", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "member",
    "list",
    "--sort",
    "future_sort",
    "--order",
    "future_order",
  ]);

  expect(get.mock.calls[0][1].params.query).toEqual({
    sort: "future_sort",
    order: "future_order",
  });
});

test("`team stats` resolves the team and calls the stats endpoint", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["team", "stats"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), undefined);
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/stats", {
    params: { path: { team_name: "resolved-team" } },
  });
});

test("`team stats` renders each count as its own field", async () => {
  get.mockResolvedValue(
    ok200({
      members: 4,
      posts: 13963,
      posts_wip: 962,
      posts_shipped: 13001,
      comments: 25883,
      stars: 2613,
      daily_active_users: 1,
      weekly_active_users: 2,
      monthly_active_users: 3,
    }),
  );
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["team", "stats"]);

  // 値を合成すると取り違えに気づきにくく、パイプ先も内訳を取り出せない。
  expect((log.mock.calls[0][0] as string).split("\n")).toEqual([
    "members\t4",
    "posts\t13963",
    "posts_wip\t962",
    "posts_shipped\t13001",
    "comments\t25883",
    "stars\t2613",
    "daily_active_users\t1",
    "weekly_active_users\t2",
    "monthly_active_users\t3",
  ]);
});

test("`post backlinks` sends the post number and paging query", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "backlinks", "42", "--per-page", "10"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/backlinks",
    {
      params: {
        path: { team_name: "resolved-team", post_number: 42 },
        query: { per_page: 10 },
      },
    },
  );
});

test("`post backlinks` rejects a non-numeric post number before any network call", async () => {
  await expect(run(["post", "backlinks", "abc"])).rejects.toThrow(
    /positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});
