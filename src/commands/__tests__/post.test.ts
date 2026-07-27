import { stripVTControlCharacters } from "node:util";
import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { captureStdout } from "../../test-utils/stdout.js";

const get = vi.fn();
const postReq = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();
const confirm = vi.fn<() => Promise<boolean>>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({
    GET: get,
    POST: postReq,
    PATCH: patch,
    DELETE: del,
  }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));
vi.mock("../confirm.js", () => ({ confirm }));

const { registerPostCommand } = await import("../post.js");

const originalIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;
const originalColumns = process.stdout.columns;

/** 一覧の表示に使うフィールドだけを持つ記事。 */
function post(overrides: Record<string, unknown> = {}) {
  return {
    number: 14184,
    name: "esa-cli微調整",
    full_name: "日報/2026/07/26/esa-cli微調整",
    wip: true,
    updated_at: "2026-07-26T10:40:30+09:00",
    updated_by: { screen_name: "ppworks" },
    ...overrides,
  };
}

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerPostCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok200({ posts: [], total_count: 0 }));
  postReq.mockReset().mockResolvedValue(ok200({ number: 1 }));
  patch.mockReset().mockResolvedValue(ok200({ number: 1 }));
  del.mockReset().mockResolvedValue({
    data: undefined,
    response: new Response(null, { status: 204 }),
  });
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
  confirm.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  process.stdout.isTTY = originalStdoutIsTTY;
  process.stdout.columns = originalColumns;
  vi.restoreAllMocks();
});

test("`post list` resolves the team and calls GET with the team path", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = false;

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
  // 該当なしのときは、下流に見出しだけが流れないよう stdout を空のままにする。
  expect(output()).toBe("");
});

test("`post list` writes tab-separated rows when stdout is not a TTY", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = false;
  get.mockResolvedValue(
    ok200({ posts: [post(), post({ number: 14183, wip: false })] }),
  );

  await run(["post", "list"]);

  // 見出しは出さず、更新日時は機械が解釈できる ISO 8601 のまま渡す。
  expect(output()).toBe(
    [
      "14184\t日報/2026/07/26/esa-cli微調整\tWIP\tppworks\t2026-07-26T10:40:30+09:00",
      "14183\t日報/2026/07/26/esa-cli微調整\tShip\tppworks\t2026-07-26T10:40:30+09:00",
      "",
    ].join("\n"),
  );
});

test("`post list` writes an aligned table with a header when stdout is a TTY", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = true;
  process.stdout.columns = 100;
  get.mockResolvedValue(ok200({ posts: [post()] }));

  await run(["post", "list"]);

  // 端末では装飾が付くため、桁揃えの検証は装飾を外してから行う。
  const lines = stripVTControlCharacters(output()).split("\n");
  expect(lines[0]).toMatch(/^NUMBER\s+TITLE\s+STATE\s+UPDATED BY\s+UPDATED$/);
  expect(lines[1]).toContain("日報/2026/07/26/esa-cli微調整");
  // 端末では相対時刻にする。表現は経過時間で変わるので ISO でないことを見る。
  expect(lines[1]).not.toContain("2026-07-26T10:40:30+09:00");
});

test("`post list --json` keeps pagination and narrows only the posts", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  get.mockResolvedValue(
    ok200({ posts: [post()], next_page: 2, total_count: 13961 }),
  );

  await run(["post", "list", "--json", "number,full_name"]);

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    posts: [{ number: 14184, full_name: "日報/2026/07/26/esa-cli微調整" }],
    next_page: 2,
    total_count: 13961,
  });
});

test("`post list --json` without fields lists the candidates from the response", async () => {
  get.mockResolvedValue(ok200({ posts: [post()] }));

  await expect(run(["post", "list", "--json"])).rejects.toThrow(
    /Specify one or more comma-separated fields[\s\S]*full_name/,
  );
});

test("`post list` reports an empty result to stderr only on a TTY", async () => {
  const { output } = captureStdout();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  process.stdout.isTTY = true;
  process.stdout.columns = 100;

  await run(["post", "list"]);

  expect(output()).toBe("");
  expect(error).toHaveBeenCalledWith("No results found.");
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
    /--page.*positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`post search` puts the positional query into q", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "search", "keyword", "--per-page", "3"]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: {
      path: { team_name: "resolved-team" },
      query: { q: "keyword", per_page: 3 },
    },
  });
});

/** 詳細表示が読むフィールドを揃えた記事。 */
function postDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...post(),
    number: 123,
    tags: ["設計"],
    category: "日報/2026/07/26",
    body_md: "# 見出し\n本文",
    revision_number: 2,
    comments_count: 0,
    url: "https://ware2.esa.io/posts/123",
    ...overrides,
  };
}

test("`post get` calls GET with the post number in the path", async () => {
  get.mockResolvedValue(ok200(postDetail()));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = false;

  await run(["post", "get", "123"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    { params: { path: { team_name: "resolved-team", post_number: 123 } } },
  );
  // JSON は --json を指定したときだけ。既定はタブ区切りのキーと値 + 本文。
  expect((log.mock.calls[0][0] as string).split("\n")).toEqual([
    "wip\tWIP",
    "category\t日報/2026/07/26",
    "tags\t設計",
    "updated_by\tppworks",
    "updated_at\t2026-07-26T10:40:30+09:00",
    "revision_number\t2",
    "comments_count\t0",
    "url\thttps://ware2.esa.io/posts/123",
    "--",
    "# 見出し",
    "本文",
  ]);
});

test("`post get` renders a readable summary and the raw body on a TTY", async () => {
  get.mockResolvedValue(ok200(postDetail()));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;
  process.stdout.columns = 100;

  await run(["post", "get", "123"]);

  const lines = stripVTControlCharacters(log.mock.calls[0][0] as string).split(
    "\n",
  );
  expect(lines).toEqual([
    "日報/2026/07/26/esa-cli微調整 (#123)",
    "  - State: WIP",
    "  - Category: 日報/2026/07/26",
    "  - Tags: 設計",
    "  - Updated by: ppworks",
    // 端末では相対表示になる。表現は経過時間で変わるので ISO でないことを見る。
    expect.stringMatching(/^ {2}- Updated: (?!2026-07-26T).+$/),
    "  - Revision: 2",
    "  - Comments: 0",
    "  - URL: https://ware2.esa.io/posts/123",
    "",
    // 本文は描画せず、そのまま出す。
    "# 見出し",
    "本文",
  ]);
});

test("`post get --json` narrows the fields", async () => {
  get.mockResolvedValue(ok200(postDetail()));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "get", "123", "--json", "number,tags"]);

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    number: 123,
    tags: ["設計"],
  });
});

test("`post get` rejects a non-numeric post number before any network call", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await expect(run(["post", "get", "abc"])).rejects.toThrow(
    /post number.*positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`post create` posts name/body with wip defaulting to true", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "create", "Hello", "--body", "world"]);

  expect(postReq).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: { path: { team_name: "resolved-team" } },
    body: {
      post: {
        name: "Hello",
        body_md: "world",
        category: undefined,
        tags: undefined,
        wip: true,
        message: undefined,
      },
    },
  });
});

test("`post create` splits a slashed name into category and title", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "create", "dev/docs/Title", "--tags", "a, b ,,c"]);

  const body = postReq.mock.calls[0][1].body.post;
  expect(body.name).toBe("Title");
  expect(body.category).toBe("dev/docs");
  expect(body.tags).toEqual(["a", "b", "c"]);
});

test("`post create` --ship sends wip:false", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "create", "Hello", "--body", "x", "--ship"]);

  expect(postReq.mock.calls[0][1].body.post.wip).toBe(false);
});

test("`post create` rejects --body and --body-file together before network", async () => {
  await expect(
    run(["post", "create", "Hi", "--body", "x", "--body-file", "y.md"]),
  ).rejects.toThrow(/--body and --body-file/);
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(postReq).not.toHaveBeenCalled();
});

test("`post create` rejects a name that is empty after the slash split", async () => {
  await expect(run(["post", "create", "foo/"])).rejects.toThrow(
    /Post name is empty/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(postReq).not.toHaveBeenCalled();
});

test("`post update --name` rejects a name that is empty after the slash split", async () => {
  await expect(run(["post", "update", "5", "--name", "foo/"])).rejects.toThrow(
    /Post name is empty/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(patch).not.toHaveBeenCalled();
});

test("`post update` patches only the provided fields (wip stays undefined)", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "update", "42", "--name", "New"]);

  expect(patch).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    {
      params: { path: { team_name: "resolved-team", post_number: 42 } },
      body: {
        post: {
          name: "New",
          body_md: undefined,
          category: undefined,
          tags: undefined,
          wip: undefined,
          message: undefined,
        },
      },
    },
  );
});

test("`post append` posts content to the append endpoint", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "append", "7", "--body", "more"]);

  expect(postReq).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/append",
    {
      params: { path: { team_name: "resolved-team", post_number: 7 } },
      body: { post: { content: "more", wip: undefined, message: undefined } },
    },
  );
});

test("`post append` requires a body", async () => {
  await expect(run(["post", "append", "7"])).rejects.toThrow(
    /Body is required/,
  );
  expect(postReq).not.toHaveBeenCalled();
});

test("`post prepend` posts content to the prepend endpoint", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "prepend", "7", "--body", "intro"]);

  expect(postReq).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/prepend",
    expect.objectContaining({
      body: { post: { content: "intro", wip: undefined, message: undefined } },
    }),
  );
});

test("`post archive` moves the current category under Archived/", async () => {
  get.mockResolvedValue(ok200({ number: 9, category: "dev/docs" }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "archive", "9"]);

  expect(patch).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    {
      params: { path: { team_name: "resolved-team", post_number: 9 } },
      body: {
        post: { category: "Archived/dev/docs", message: undefined },
      },
    },
  );
});

test("`post archive -m` sends the given message", async () => {
  get.mockResolvedValue(ok200({ number: 9, category: "dev" }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "archive", "9", "-m", "retire"]);

  expect(patch.mock.calls[0][1].body.post.message).toBe("retire");
});

test("`post archive` is a no-op but still prints the URL when already archived", async () => {
  get.mockResolvedValue(
    ok200({
      number: 9,
      category: "Archived/dev",
      url: "https://ware2.esa.io/posts/9",
    }),
  );
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "archive", "9"]);

  expect(patch).not.toHaveBeenCalled();
  expect(err.mock.calls[0][0]).toMatch(/already archived/);
  // 変更は起きないが、記事を辿れるよう URL は出す。
  expect(log.mock.calls[0][0]).toBe("https://ware2.esa.io/posts/9");
});

test("`post archive --json` narrows the fields even when already archived", async () => {
  get.mockResolvedValue(
    ok200({
      number: 9,
      category: "Archived/dev",
      url: "https://ware2.esa.io/posts/9",
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "archive", "9", "--json", "number,url"]);

  expect(patch).not.toHaveBeenCalled();
  // 記事の状態によって --json の扱いが変わらないようにする。
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    number: 9,
    url: "https://ware2.esa.io/posts/9",
  });
});

test("`post create` puts the URL on stdout and the confirmation on stderr", async () => {
  postReq.mockResolvedValue(
    ok200({
      number: 14186,
      full_name: "日報/2026/07/27/新しい記事",
      url: "https://ware2.esa.io/posts/14186",
    }),
  );
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "create", "新しい記事", "--body", "本文"]);

  // stdout は URL だけ。`esa post create ... > url.txt` で取り出せる。
  expect(log.mock.calls).toEqual([["https://ware2.esa.io/posts/14186"]]);
  expect(stripVTControlCharacters(err.mock.calls[0][0] as string)).toBe(
    "✓ Created post #14186 日報/2026/07/27/新しい記事.",
  );
});

test("`post create --json` replaces the URL with the chosen fields", async () => {
  postReq.mockResolvedValue(
    ok200({
      number: 14186,
      full_name: "日報/2026/07/27/新しい記事",
      url: "https://ware2.esa.io/posts/14186",
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run([
    "post",
    "create",
    "新しい記事",
    "--body",
    "本文",
    "--json",
    "number",
  ]);

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ number: 14186 });
});

test("`post delete --yes` deletes without confirmation", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["post", "delete", "5", "--yes"]);

  expect(confirm).not.toHaveBeenCalled();
  expect(del).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    { params: { path: { team_name: "resolved-team", post_number: 5 } } },
  );
  expect(err.mock.calls[0][0]).toMatch(/Deleted post #5/);
});

test("`post delete` requires --yes in a non-interactive environment", async () => {
  process.stdin.isTTY = false;

  await expect(run(["post", "delete", "5"])).rejects.toThrow(
    /requires confirmation/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(del).not.toHaveBeenCalled();
});

test("`post delete` prompts and aborts when the user declines", async () => {
  process.stdin.isTTY = true;
  get.mockResolvedValue(ok200({ number: 5, name: "Doomed" }));
  confirm.mockResolvedValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["post", "delete", "5"]);

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Doomed"));
  expect(del).not.toHaveBeenCalled();
});

test("`post revisions` calls the revisions endpoint with paging", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "revisions", "9", "--per-page", "5"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/revisions",
    {
      params: {
        path: { team_name: "resolved-team", post_number: 9 },
        query: { per_page: 5 },
      },
    },
  );
});

test("`post revisions` rejects a non-numeric post number before network", async () => {
  await expect(run(["post", "revisions", "abc"])).rejects.toThrow(
    /positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`post duplicate` fetches the prefill then creates a WIP copy", async () => {
  get.mockResolvedValue(ok200({ post: { name: "dev/Copy", body_md: "hi" } }));
  postReq.mockResolvedValue(ok200({ number: 42 }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "duplicate", "7"]);

  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/posts/new", {
    params: {
      path: { team_name: "resolved-team" },
      query: { parent_post_id: 7 },
    },
  });
  expect(postReq).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: { path: { team_name: "resolved-team" } },
    body: { post: { name: "dev/Copy", body_md: "hi", wip: true } },
  });
});

test("`post duplicate --target-team` creates the copy in the target team", async () => {
  get.mockResolvedValue(ok200({ post: { name: "Copy", body_md: "hi" } }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "duplicate", "7", "--target-team", "other"]);

  // 複製元の prefill はソースチーム（resolved-team）、作成先は --target-team。
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/posts/new", {
    params: {
      path: { team_name: "resolved-team" },
      query: { parent_post_id: 7 },
    },
  });
  expect(postReq).toHaveBeenCalledWith("/v1/teams/{team_name}/posts", {
    params: { path: { team_name: "other" } },
    body: { post: { name: "Copy", body_md: "hi", wip: true } },
  });
});

test("`post rollback` posts to the rollback endpoint", async () => {
  postReq.mockResolvedValue(ok200({ number: 9 }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "rollback", "9", "3", "--ship", "-m", "戻す"]);

  expect(postReq).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/revisions/{revision_number}/rollback",
    {
      params: {
        path: {
          team_name: "resolved-team",
          post_number: 9,
          revision_number: 3,
        },
      },
      body: { post: { wip: false, message: "戻す" } },
    },
  );
});

test("`post rollback` rejects a non-numeric revision before network", async () => {
  await expect(run(["post", "rollback", "9", "abc"])).rejects.toThrow(
    /positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(postReq).not.toHaveBeenCalled();
});
