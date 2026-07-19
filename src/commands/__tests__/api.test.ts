import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
const postReq = vi.fn();
const patch = vi.fn();
const del = vi.fn();
const resolveTeam = vi.fn<() => Promise<string>>();
const readFileSync = vi.fn<() => string>();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({
    GET: get,
    POST: postReq,
    PATCH: patch,
    DELETE: del,
  }),
}));
vi.mock("../../api/resolve-team.js", () => ({ resolveTeam }));
vi.mock("node:fs", () => ({ readFileSync }));

const { registerApiCommand } = await import("../api.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerApiCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const ok200 = (data: unknown) => ({
  data,
  response: new Response(null, { status: 200 }),
});

beforeEach(() => {
  get.mockReset().mockResolvedValue(ok200({ ok: true }));
  postReq.mockReset().mockResolvedValue(ok200({ id: 1 }));
  patch.mockReset().mockResolvedValue(ok200({ id: 1 }));
  del.mockReset().mockResolvedValue({
    data: undefined,
    response: new Response(null, { status: 204 }),
  });
  resolveTeam.mockReset().mockResolvedValue("resolved-team");
  readFileSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`api` GETs the endpoint by default and prints the response", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/user"]);

  expect(get).toHaveBeenCalledWith("/v1/user", {});
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ ok: true });
});

test("`api` passes -f fields as query params", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/posts", "-f", "q=wip:true", "-f", "per_page=5"]);

  expect(get).toHaveBeenCalledWith("/v1/posts", {
    params: { query: { q: "wip:true", per_page: "5" } },
  });
});

test("`api` resolves the {team} placeholder in the path", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/teams/{team}/posts", "--team", "docs"]);

  expect(resolveTeam).toHaveBeenCalledWith(expect.anything(), "docs");
  expect(get).toHaveBeenCalledWith("/v1/teams/resolved-team/posts", {});
});

test("`api` uses the explicit method", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["api", "/v1/teams/t/comments/5", "-X", "DELETE"]);

  expect(del).toHaveBeenCalledWith("/v1/teams/t/comments/5", {});
});

test("`api --input -` reads stdin, defaults to POST, and sends parsed JSON", async () => {
  readFileSync.mockReturnValue('{"comment":{"body_md":"hi"}}');
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/teams/t/posts/1/comments", "--input", "-"]);

  expect(readFileSync).toHaveBeenCalledWith(0, "utf-8");
  expect(postReq).toHaveBeenCalledWith("/v1/teams/t/posts/1/comments", {
    body: { comment: { body_md: "hi" } },
  });
});

test("`api -H` adds request headers", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/user", "-H", "X-Foo: bar"]);

  expect(get).toHaveBeenCalledWith("/v1/user", {
    headers: { "X-Foo": "bar" },
  });
});

test("`api` rejects an endpoint without a leading slash before network", async () => {
  await expect(run(["api", "v1/user"])).rejects.toThrow(/must start with/);
  expect(get).not.toHaveBeenCalled();
});

test("`api` rejects an unsupported method before network", async () => {
  await expect(run(["api", "/v1/user", "-X", "BREW"])).rejects.toThrow(
    /Unsupported --method/,
  );
  expect(resolveTeam).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test("`api` rejects a malformed -f field before network", async () => {
  await expect(run(["api", "/v1/user", "-f", "noequals"])).rejects.toThrow(
    /Invalid --field/,
  );
  expect(get).not.toHaveBeenCalled();
});

test("`api` rejects an invalid JSON body before network", async () => {
  readFileSync.mockReturnValue("{not json");

  await expect(
    run(["api", "/v1/teams/t/posts", "--input", "body.json"]),
  ).rejects.toThrow(/not valid JSON/);
  expect(postReq).not.toHaveBeenCalled();
});

test("`api` still defaults to POST when --input is empty", async () => {
  readFileSync.mockReturnValue("");
  vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["api", "/v1/teams/t/posts", "--input", "-"]);

  expect(get).not.toHaveBeenCalled();
  expect(postReq).toHaveBeenCalledWith("/v1/teams/t/posts", {});
});

test("`api` rejects a header with an empty name before network", async () => {
  await expect(run(["api", "/v1/user", "-H", ":value"])).rejects.toThrow(
    /Invalid --header/,
  );
  expect(get).not.toHaveBeenCalled();
});

test("`api` rejects a field with an empty key before network", async () => {
  await expect(run(["api", "/v1/user", "-f", "=value"])).rejects.toThrow(
    /Invalid --field/,
  );
  expect(get).not.toHaveBeenCalled();
});
