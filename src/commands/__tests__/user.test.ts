import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const get = vi.fn();
vi.mock("../../api/client.js", () => ({
  createEsaClient: () => ({ GET: get }),
}));

const { registerUserCommand } = await import("../user.js");

beforeEach(() => {
  get.mockReset();
});

const originalStdoutIsTTY = process.stdout.isTTY;

afterEach(() => {
  process.stdout.isTTY = originalStdoutIsTTY;
  vi.restoreAllMocks();
});

test("`esa user` prints tab-separated fields when piped", async () => {
  const user = {
    id: 16490,
    name: "Someone",
    screen_name: "someone",
    email: "someone@example.com",
  };
  get.mockResolvedValue({
    data: user,
    response: new Response(null, { status: 200 }),
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = false;

  const program = new Command();
  registerUserCommand(program);
  await program.parseAsync(["user"], { from: "user" });

  expect(get).toHaveBeenCalledWith("/v1/user");
  expect(log.mock.calls[0][0]).toBe(
    "screen_name\tsomeone\nemail\tsomeone@example.com",
  );
});

test("`esa user --json` can select fields the summary does not show", async () => {
  const user = {
    id: 16490,
    name: "Someone",
    screen_name: "someone",
    created_at: "2020-01-01T00:00:00+09:00",
  };
  get.mockResolvedValue({
    data: user,
    response: new Response(null, { status: 200 }),
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  const program = new Command();
  registerUserCommand(program);
  await program.parseAsync(["user", "--json", "id,created_at"], {
    from: "user",
  });

  // 絞り込む対象は応答そのものなので、表示に使う項目に縛られない。
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    id: 16490,
    created_at: "2020-01-01T00:00:00+09:00",
  });
});

test("`esa user` surfaces a 401 as an error", async () => {
  get.mockResolvedValue({ response: new Response(null, { status: 401 }) });
  vi.spyOn(console, "log").mockImplementation(() => {});

  const program = new Command();
  program.exitOverride();
  registerUserCommand(program);

  await expect(program.parseAsync(["user"], { from: "user" })).rejects.toThrow(
    /401/,
  );
});
