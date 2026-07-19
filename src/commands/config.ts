import type { Command } from "commander";
import { getDefaultTeam, setDefaultTeam } from "../config/file-store.js";

const KEY_DEFAULT_TEAM = "default-team";

function assertKnownKey(key: string): void {
  if (key !== KEY_DEFAULT_TEAM) {
    throw new Error(`未知の設定キーです: ${key}（対応: ${KEY_DEFAULT_TEAM}）`);
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage esa-cli settings (~/.config/esa-cli/config.json)");

  config
    .command("set")
    .argument("<key>", `設定キー（${KEY_DEFAULT_TEAM}）`)
    .argument("<value>", "値")
    .description("Set a config value")
    .action((key: string, value: string) => {
      assertKnownKey(key);
      setDefaultTeam(value);
      console.error(`${key} を ${value} に設定しました。`);
    });

  config
    .command("get")
    .argument("<key>", `設定キー（${KEY_DEFAULT_TEAM}）`)
    .description("Get a config value")
    .action((key: string) => {
      assertKnownKey(key);
      const value = getDefaultTeam();
      // 未設定なら何も出力しない（exit 0）。設定済みなら値のみ出す。
      if (value != null) console.log(value);
    });
}
