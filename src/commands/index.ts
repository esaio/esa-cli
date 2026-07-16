import type { Command } from "commander";
import { registerAuthCommand } from "./auth.js";

export function registerCommands(program: Command): void {
  registerAuthCommand(program);
}
