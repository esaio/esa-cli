import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

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

test("`post get` calls GET with the post number in the path", async () => {
  get.mockResolvedValue(ok200({ number: 123, name: "hi" }));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["post", "get", "123"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}",
    { params: { path: { team_name: "resolved-team", post_number: 123 } } },
  );
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
        post: { category: "Archived/dev/docs", message: "Archive post" },
      },
    },
  );
});

test("`post archive` is a no-op when already archived", async () => {
  get.mockResolvedValue(ok200({ number: 9, category: "Archived/dev" }));
  const err = vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["post", "archive", "9"]);

  expect(patch).not.toHaveBeenCalled();
  expect(err.mock.calls[0][0]).toMatch(/already archived/);
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
