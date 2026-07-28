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

const { registerCommentCommand } = await import("../comment.js");

const originalIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerCommentCommand(program);
  return program.parseAsync(args, { from: "user" });
}

/** 詳細表示が読むフィールドを揃えたコメント。 */
function commentDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    post_number: 42,
    body_md: "LGTM :+1:\n続きの行",
    created_at: "2026-07-26T10:40:30+09:00",
    created_by: { screen_name: "ppworks" },
    stargazers_count: 3,
    url: "https://ware2.esa.io/posts/42#comment-7",
    ...overrides,
  };
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok200({ comments: [], total_count: 0 }));
  postReq.mockReset().mockResolvedValue(ok200({ id: 1 }));
  patch.mockReset().mockResolvedValue(ok200({ id: 1 }));
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
  vi.restoreAllMocks();
});

test("`comment list` fetches team comments by default", async () => {
  const { output } = captureStdout();
  process.stdout.isTTY = false;
  get.mockResolvedValue(
    ok200({
      comments: [
        {
          id: 7,
          post_number: 42,
          body_md: "LGTM :+1:\n続きの行",
          created_at: "2026-07-26T10:40:30+09:00",
          created_by: { screen_name: "ppworks" },
        },
      ],
      total_count: 1,
    }),
  );

  await run(["comment", "list", "--team", "docs", "--per-page", "5"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(get).toHaveBeenCalledWith("/v1/teams/{team_name}/comments", {
    params: { path: { team_name: "resolved-team" }, query: { per_page: 5 } },
  });
  // 本文は桁揃えを壊さないよう先頭行だけにする。
  expect(output()).toBe(
    "7\t42\tLGTM :+1:\tppworks\t2026-07-26T10:40:30+09:00\n",
  );
});

test("`comment list --post` fetches that post's comments", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "list", "--post", "42", "--page", "2"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/comments",
    {
      params: {
        path: { team_name: "resolved-team", post_number: 42 },
        query: { page: 2 },
      },
    },
  );
});

test("`comment list` rejects an invalid --post before any network call", async () => {
  await expect(run(["comment", "list", "--post", "abc"])).rejects.toThrow(
    /--post.*positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`comment get` calls GET with the comment id in the path", async () => {
  get.mockResolvedValue(ok200(commentDetail()));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "get", "7"]);

  expect(get).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/comments/{comment_id}",
    {
      params: {
        path: { team_name: "resolved-team", comment_id: 7 },
        query: {},
      },
    },
  );
});

test("`comment get` renders the fields and the raw body", async () => {
  get.mockResolvedValue(ok200(commentDetail()));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = false;

  await run(["comment", "get", "7"]);

  // 本文の前に -- を挟み、どこまでがメタ情報かを機械が判定できるようにする。
  expect((log.mock.calls[0][0] as string).split("\n")).toEqual([
    "post_number\t42",
    "created_by\tppworks",
    "created_at\t2026-07-26T10:40:30+09:00",
    "stargazers_count\t3",
    "url\thttps://ware2.esa.io/posts/42#comment-7",
    "--",
    "LGTM :+1:",
    "続きの行",
  ]);
});

test("`comment get --stargazers` includes stargazers", async () => {
  get.mockResolvedValue(ok200(commentDetail()));
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "get", "7", "--stargazers"]);

  expect(get.mock.calls[0][1].params.query).toEqual({ include: "stargazers" });
});

test("`comment get` rejects a non-numeric id before any network call", async () => {
  await expect(run(["comment", "get", "abc"])).rejects.toThrow(
    /comment ID.*positive integer/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`comment create` posts the body to the post's comments endpoint", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "create", "42", "--body", "nice work"]);

  expect(postReq).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/posts/{post_number}/comments",
    {
      params: { path: { team_name: "resolved-team", post_number: 42 } },
      body: { comment: { body_md: "nice work", user: undefined } },
    },
  );
});

test("`comment create --user` sets the author", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "create", "42", "--body", "x", "--user", "alice"]);

  expect(postReq.mock.calls[0][1].body.comment.user).toBe("alice");
});

test("`comment create` requires a body", async () => {
  await expect(run(["comment", "create", "42"])).rejects.toThrow(
    /Body is required/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(postReq).not.toHaveBeenCalled();
});

test("`comment update` patches the comment body", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["comment", "update", "7", "--body", "edited"]);

  expect(patch).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/comments/{comment_id}",
    {
      params: { path: { team_name: "resolved-team", comment_id: 7 } },
      body: { comment: { body_md: "edited", user: undefined } },
    },
  );
});

test("`comment update` requires a body", async () => {
  await expect(run(["comment", "update", "7"])).rejects.toThrow(
    /Body is required/,
  );
  expect(patch).not.toHaveBeenCalled();
});

test("`comment delete --yes` deletes without confirmation", async () => {
  const err = vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["comment", "delete", "7", "--yes"]);

  expect(confirm).not.toHaveBeenCalled();
  expect(del).toHaveBeenCalledWith(
    "/v1/teams/{team_name}/comments/{comment_id}",
    { params: { path: { team_name: "resolved-team", comment_id: 7 } } },
  );
  expect(err.mock.calls[0][0]).toMatch(/Deleted comment #7/);
});

test("`comment delete` requires --yes in a non-interactive environment", async () => {
  process.stdin.isTTY = false;

  await expect(run(["comment", "delete", "7"])).rejects.toThrow(
    /requires confirmation/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(del).not.toHaveBeenCalled();
});

test("`comment delete` prompts with a body preview and aborts when declined", async () => {
  process.stdin.isTTY = true;
  get.mockResolvedValue(ok200({ id: 7, body_md: "Doomed comment" }));
  confirm.mockResolvedValue(false);
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["comment", "delete", "7"]);

  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Doomed"));
  expect(del).not.toHaveBeenCalled();
});
