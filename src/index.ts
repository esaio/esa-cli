#!/usr/bin/env node
import { Command } from "commander";
import { formatCliError } from "./cli-error.js";
import { registerCommands } from "./commands/index.js";
import { config } from "./config/index.js";
import { t } from "./i18n/index.js";

const program = new Command();

program
  .name(config.cli.name)
  .description(t("cli.description"))
  .version(config.cli.version);

registerCommands(program);

program.parseAsync(process.argv).catch((error) => {
  console.error(formatCliError(error, process.env.ESA_DEBUG === "1"));
  process.exitCode = 1;
});
