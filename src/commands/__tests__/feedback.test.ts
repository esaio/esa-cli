import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const postReq = vi.fn();

vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ POST: postReq }),
}));

const { registerFeedbackCommand } = await import("../feedback.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerFeedbackCommand(program);
  return program.parseAsync(args, { from: "user" });
}

const created = () => ({
  data: undefined,
  response: new Response(null, { status: 201 }),
});

beforeEach(() => {
  postReq.mockReset().mockResolvedValue(created());
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`feedback create` posts to the global endpoint with client meta", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["feedback", "create", "-m", "改善要望"]);

  expect(postReq).toHaveBeenCalledTimes(1);
  const [path, options] = postReq.mock.calls[0];
  expect(path).toBe("/v1/feedbacks");
  expect(options.body.feedback.message).toBe("改善要望");
  expect(options.body.feedback.email).toBeUndefined();
  expect(options.body.feedback.meta).toMatchObject({
    client_name: "esa-cli",
    os: process.platform,
    arch: process.arch,
  });
  expect(options.body.feedback.meta.client_version).toBeTruthy();
});

test("`feedback create` accepts --body as an alias for --message", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["feedback", "create", "--body", "別名でも送れる"]);

  expect(postReq.mock.calls[0][1].body.feedback.message).toBe("別名でも送れる");
});

test("`feedback create --team` posts to the team endpoint", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["feedback", "create", "-m", "チームの件", "--team", "docs"]);

  const [path, options] = postReq.mock.calls[0];
  expect(path).toBe("/v1/teams/{team_name}/feedbacks");
  expect(options.params).toEqual({ path: { team_name: "docs" } });
  expect(options.body.feedback.message).toBe("チームの件");
});

test("`feedback create --team` resolves the team (trims whitespace)", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["feedback", "create", "-m", "x", "--team", "  docs  "]);

  expect(postReq.mock.calls[0][1].params).toEqual({
    path: { team_name: "docs" },
  });
});

test("`feedback create` reads the message from a file via --message-file", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const dir = mkdtempSync(join(tmpdir(), "esa-fb-"));
  try {
    const file = join(dir, "feedback.md");
    writeFileSync(file, "本文（ファイル）");

    await run(["feedback", "create", "--message-file", file]);

    expect(postReq.mock.calls[0][1].body.feedback.message).toBe(
      "本文（ファイル）",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`feedback create` requires a message before any network call", async () => {
  await expect(run(["feedback", "create"])).rejects.toThrow(/message/i);
  expect(postReq).not.toHaveBeenCalled();
});

test("`feedback create` rejects more than one message source", async () => {
  await expect(
    run(["feedback", "create", "--body", "x", "--message", "y"]),
  ).rejects.toThrow();
  await expect(
    run(["feedback", "create", "-m", "x", "--message-file", "y.md"]),
  ).rejects.toThrow();
  expect(postReq).not.toHaveBeenCalled();
});
