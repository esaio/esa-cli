import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getDefaultTeam = vi.fn<() => string | undefined>();
const setDefaultTeam = vi.fn<(team: string) => void>();

vi.mock("../../config/file-store.js", () => ({
  getDefaultTeam,
  setDefaultTeam,
}));

const { registerConfigCommand } = await import("../config.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerConfigCommand(program);
  return program.parseAsync(args, { from: "user" });
}

beforeEach(() => {
  getDefaultTeam.mockReset();
  setDefaultTeam.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`config set default-team` stores the value", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["config", "set", "default-team", "docs"]);

  expect(setDefaultTeam).toHaveBeenCalledWith("docs");
});

test("`config set` rejects an unknown key", async () => {
  await expect(run(["config", "set", "bogus", "x"])).rejects.toThrow(
    /未知の設定キー/,
  );
  expect(setDefaultTeam).not.toHaveBeenCalled();
});

test("`config set` rejects a whitespace-only value", async () => {
  await expect(run(["config", "set", "default-team", "  "])).rejects.toThrow(
    /値が空/,
  );
  expect(setDefaultTeam).not.toHaveBeenCalled();
});

test("`config set` trims surrounding whitespace before saving", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["config", "set", "default-team", "  docs  "]);

  expect(setDefaultTeam).toHaveBeenCalledWith("docs");
});

test("`config get default-team` prints the value", async () => {
  getDefaultTeam.mockReturnValue("docs");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["config", "get", "default-team"]);

  expect(log).toHaveBeenCalledWith("docs");
});

test("`config get default-team` prints nothing when unset", async () => {
  getDefaultTeam.mockReturnValue(undefined);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["config", "get", "default-team"]);

  expect(log).not.toHaveBeenCalled();
});

test("`config get` without a key errors (key is required)", async () => {
  await expect(run(["config", "get"])).rejects.toThrow();
});

test("`config get` rejects an unknown key", async () => {
  await expect(run(["config", "get", "bogus"])).rejects.toThrow(
    /未知の設定キー/,
  );
});
