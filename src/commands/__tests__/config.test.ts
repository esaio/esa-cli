import { Command } from "commander";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getDefaultTeam = vi.fn<() => string | undefined>();
const setDefaultTeam = vi.fn<(team: string) => void>();
const getLanguage = vi.fn<() => string | undefined>();
const setLanguage = vi.fn<(language: string) => void>();

vi.mock("../../config/file-store.js", () => ({
  getDefaultTeam,
  setDefaultTeam,
  getLanguage,
  setLanguage,
}));

const { registerConfigCommand } = await import("../config.js");

function run(args: string[]): Promise<Command> {
  const program = new Command();
  program.exitOverride();
  registerConfigCommand(program);
  return program.parseAsync(args, { from: "user" });
}

// --help は exitOverride で例外を投げて終わるので、出力を横取りしてから捨てる。
function help(args: string[]): string {
  let out = "";
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => {
      out += str;
    },
  });
  registerConfigCommand(program);
  try {
    program.parse(args, { from: "user" });
  } catch {
    // commander.helpDisplayed
  }
  return out;
}

beforeEach(() => {
  getDefaultTeam.mockReset();
  setDefaultTeam.mockReset();
  getLanguage.mockReset();
  setLanguage.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("`config --help` lists every supported key and what it does", () => {
  const out = help(["config", "--help"]);

  expect(out).toContain("Supported keys:");
  expect(out).toMatch(/default-team {2}Team to use when --team and ESA_TEAM/);
  expect(out).toMatch(
    /language {6}Language for messages and --help \(en \| ja\)/,
  );
});

test.each([["set"], ["get"]])(
  "`config %s --help` lists the supported keys too",
  (subcommand) => {
    const out = help(["config", subcommand, "--help"]);

    expect(out).toContain("Supported keys:");
    expect(out).toContain("default-team");
    expect(out).toContain("language");
  },
);

test("`config set default-team` stores the value", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["config", "set", "default-team", "docs"]);

  expect(setDefaultTeam).toHaveBeenCalledWith("docs");
});

test("`config set` rejects an unknown key", async () => {
  await expect(run(["config", "set", "bogus", "x"])).rejects.toThrow(
    /Unknown config key/,
  );
  expect(setDefaultTeam).not.toHaveBeenCalled();
});

test("`config set` rejects a whitespace-only value", async () => {
  await expect(run(["config", "set", "default-team", "  "])).rejects.toThrow(
    /default-team must not be empty/,
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
    /Unknown config key/,
  );
});

test("`config set language` stores a supported language", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  await run(["config", "set", "language", "ja"]);

  expect(setLanguage).toHaveBeenCalledWith("ja");
  expect(setDefaultTeam).not.toHaveBeenCalled();
});

test("`config set language` rejects an unsupported language", async () => {
  await expect(run(["config", "set", "language", "fr"])).rejects.toThrow(
    /must be one of/,
  );
  expect(setLanguage).not.toHaveBeenCalled();
});

test("`config get language` prints the value", async () => {
  getLanguage.mockReturnValue("ja");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  await run(["config", "get", "language"]);

  expect(log).toHaveBeenCalledWith("ja");
  expect(getDefaultTeam).not.toHaveBeenCalled();
});
