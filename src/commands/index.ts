import type { Command } from "commander";
import { registerAuthCommand } from "./auth.js";
import { registerTeamCommand } from "./team.js";
import { registerUserCommand } from "./user.js";

export function registerCommands(program: Command): void {
  registerAuthCommand(program);
  registerUserCommand(program);
  registerTeamCommand(program);
}
