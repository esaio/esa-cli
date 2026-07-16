import { Command } from "commander";
import { afterEach, expect, test, vi } from "vitest";
import { registerAuthCommand } from "../commands/auth.js";

afterEach(() => {
  vi.restoreAllMocks();
});

test("`esa auth login` outputs hello", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const program = new Command();
  registerAuthCommand(program);

  await program.parseAsync(["auth", "login"], { from: "user" });

  expect(log).toHaveBeenCalledWith("hello");
});
