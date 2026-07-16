import type { Command } from "commander";

/**
 * `esa auth` コマンド群を登録する。
 * まずは `esa auth login` が "hello" を出力するだけの最小実装。
 */
export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authenticate esa-cli with esa.io");

  auth
    .command("login")
    .description("Log in to esa.io")
    .action(() => {
      console.log("hello");
    });
}
