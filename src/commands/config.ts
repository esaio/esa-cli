import type { Command } from "commander";
import {
  getDefaultTeam,
  getLanguage,
  setDefaultTeam,
  setLanguage,
  unsetDefaultTeam,
  unsetLanguage,
} from "../config/file-store.js";
import { t } from "../i18n/index.js";
import { SUPPORTED_LANGUAGES } from "../i18n/resolve-language.js";
import { printNotice, printSuccess } from "../output/mutation.js";
import { nonEmpty } from "./parse.js";

const KEY_DEFAULT_TEAM = "default-team";
const KEY_LANGUAGE = "language";

// 設定キーは一覧の唯一の出どころにする。ここに足せば検証・引数説明・
// `esa config --help` のキー一覧がまとめて追従する。
const CONFIG_KEYS = [
  { name: KEY_DEFAULT_TEAM, describe: () => t("config.defaultTeamKeyDesc") },
  {
    name: KEY_LANGUAGE,
    describe: () =>
      t("config.languageKeyDesc", { langs: SUPPORTED_LANGUAGES.join(" | ") }),
  },
];
const KNOWN_KEYS = CONFIG_KEYS.map((key) => key.name);
const KEY_LIST = KNOWN_KEYS.join(" / ");

/**
 * --help の末尾に出すキー一覧。description に混ぜると commander が 80 桁で
 * 折り返して桁が崩れるので、そのまま出力される addHelpText に載せる。
 */
function keyHelp(): string {
  const width = Math.max(...KNOWN_KEYS.map((key) => key.length));
  const lines = CONFIG_KEYS.map(
    (key) => `  ${key.name.padEnd(width)}  ${key.describe()}`,
  );
  return `\n${t("config.keysHeading")}\n${lines.join("\n")}`;
}

function assertKnownKey(key: string): void {
  if (!KNOWN_KEYS.includes(key)) {
    throw new Error(t("config.unknownKey", { key, keys: KEY_LIST }));
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description(t("config.desc"));

  // afterAll は自身と配下の help に出るので、config / set / get / unset の
  // どれに --help を付けてもキーの一覧が読める。
  config.addHelpText("afterAll", keyHelp);

  config
    .command("set")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .argument("<value>", t("config.valueArg"))
    .description(t("config.setDesc"))
    .action((key: string, value: string) => {
      assertKnownKey(key);
      // 前後の空白を除き、空文字は保存しない（resolveTeam の trim と揃える）。
      const trimmed = nonEmpty(value, key);
      if (key === KEY_LANGUAGE) {
        if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(trimmed)) {
          throw new Error(
            t("config.invalidLanguage", {
              key,
              langs: SUPPORTED_LANGUAGES.join(" / "),
            }),
          );
        }
        setLanguage(trimmed);
      } else {
        setDefaultTeam(trimmed);
      }
      printSuccess(t("config.setDone", { key, value: trimmed }));
    });

  config
    .command("get")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .description(t("config.getDesc"))
    .action((key: string) => {
      assertKnownKey(key);
      const value = key === KEY_LANGUAGE ? getLanguage() : getDefaultTeam();
      // 未設定なら何も出力しない（exit 0）。設定済みなら値のみ出す。
      if (value != null) console.log(value);
    });

  config
    .command("unset")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .description(t("config.unsetDesc"))
    .action((key: string) => {
      assertKnownKey(key);
      // 未設定のキーを消しても失敗にはしない（exit 0）。ただ ✓ を出すと
      // 消えたように読めるので、! で「元から無い」と伝える。
      const value = key === KEY_LANGUAGE ? getLanguage() : getDefaultTeam();
      if (value == null) {
        printNotice(t("config.unsetNotSet", { key }));
        return;
      }
      if (key === KEY_LANGUAGE) {
        unsetLanguage();
      } else {
        unsetDefaultTeam();
      }
      printSuccess(t("config.unsetDone", { key }));
    });
}
