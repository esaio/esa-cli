#!/usr/bin/env node
import { Command } from "commander";
import { setRequestTimeoutMs } from "./api/request-timeout.js";
import { formatCliError } from "./cli-error.js";
import { registerCommands } from "./commands/index.js";
import { parseTimeoutMs } from "./commands/parse.js";
import { config } from "./config/index.js";
import { t } from "./i18n/index.js";

const program = new Command();

program
  .name(config.cli.name)
  .description(t("cli.description"))
  .version(config.cli.version)
  .option("--timeout <seconds>", t("cli.timeoutOpt"));

// --timeout（正の整数秒）を API リクエストの全体タイムアウトとして適用する。
// アクション実行前に一度だけ検証・設定する。未指定ならタイムアウトなし。
program.hook("preAction", () => {
  setRequestTimeoutMs(
    parseTimeoutMs(program.opts().timeout as string | undefined),
  );
});

registerCommands(program);

program.parseAsync(process.argv).catch((error) => {
  console.error(formatCliError(error, process.env.ESA_DEBUG === "1"));
  process.exitCode = 1;
});
