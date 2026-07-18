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

afterEach(() => {
  vi.restoreAllMocks();
});

test("`esa user` prints the GET /v1/user response as JSON", async () => {
  const user = { myself: true, name: "Someone", screen_name: "someone" };
  get.mockResolvedValue({
    data: user,
    response: new Response(null, { status: 200 }),
  });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  const program = new Command();
  registerUserCommand(program);
  await program.parseAsync(["user"], { from: "user" });

  expect(get).toHaveBeenCalledWith("/v1/user");
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual(user);
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
