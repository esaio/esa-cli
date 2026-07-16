import type { Command } from "commander";
import { registerAuthCommand } from "./auth.js";

/**
 * すべてのサブコマンドを program に登録する。
 * 新しいコマンドを追加する場合はここに register 関数を追加する。
 */
export function registerCommands(program: Command): void {
  registerAuthCommand(program);
}
