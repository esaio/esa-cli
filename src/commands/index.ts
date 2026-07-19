import type { Command } from "commander";
import { registerApiCommand } from "./api.js";
import { registerAuthCommand } from "./auth.js";
import { registerCategoryCommand } from "./category.js";
import { registerCommentCommand } from "./comment.js";
import { registerConfigCommand } from "./config.js";
import { registerMemberCommand } from "./member.js";
import { registerPostCommand } from "./post.js";
import { registerTagCommand } from "./tag.js";
import { registerTeamCommand } from "./team.js";
import { registerUserCommand } from "./user.js";

export function registerCommands(program: Command): void {
  registerAuthCommand(program);
  registerUserCommand(program);
  registerTeamCommand(program);
  registerPostCommand(program);
  registerCommentCommand(program);
  registerCategoryCommand(program);
  registerTagCommand(program);
  registerMemberCommand(program);
  registerApiCommand(program);
  registerConfigCommand(program);
}
