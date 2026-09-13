import type { Command } from "commander";
import {
  type FileConfigKey,
  getConfigValue,
  setConfigValue,
  unsetConfigValue,
} from "../config/file-store.js";
import { t } from "../i18n/index.js";
import { SUPPORTED_LANGUAGES } from "../i18n/resolve-language.js";
import { printNotice, printSuccess } from "../output/mutation.js";
import { nonEmpty } from "./parse.js";

type ConfigKey = {
  /** コマンドで指定する名前（esa config set <name>）。 */
  name: string;
  /** 設定ファイル上のキー。 */
  field: FileConfigKey;
  describe: () => string;
  /** set 時の値検証。通らなければ throw する。 */
  validate?: (value: string) => void;
};

// 設定キーは一覧の唯一の出どころにする。ここに足せば検証・引数説明・
// `esa config --help` のキー一覧・ファイル上のキーがまとめて追従する。
const CONFIG_KEYS: ConfigKey[] = [
  {
    name: "default-team",
    field: "default_team",
    describe: () => t("config.defaultTeamKeyDesc"),
  },
  {
    name: "language",
    field: "language",
    describe: () =>
      t("config.languageKeyDesc", { langs: SUPPORTED_LANGUAGES.join(" | ") }),
    validate: (value) => {
      if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(value)) {
        throw new Error(
          t("config.invalidLanguage", {
            key: "language",
            langs: SUPPORTED_LANGUAGES.join(" / "),
          }),
        );
      }
    },
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

function findKey(name: string): ConfigKey {
  const key = CONFIG_KEYS.find((candidate) => candidate.name === name);
  if (!key) {
    throw new Error(t("config.unknownKey", { key: name, keys: KEY_LIST }));
  }
  return key;
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
    .action((name: string, value: string) => {
      const key = findKey(name);
      // 前後の空白を除き、空文字は保存しない（resolveTeam の trim と揃える）。
      const trimmed = nonEmpty(value, name);
      key.validate?.(trimmed);
      setConfigValue(key.field, trimmed);
      printSuccess(t("config.setDone", { key: name, value: trimmed }));
    });

  config
    .command("get")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .description(t("config.getDesc"))
    .action((name: string) => {
      const value = getConfigValue(findKey(name).field);
      // 未設定なら何も出力しない（exit 0）。設定済みなら値のみ出す。
      if (value != null) console.log(value);
    });

  config
    .command("unset")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .description(t("config.unsetDesc"))
    .action((name: string) => {
      const key = findKey(name);
      // 未設定のキーを消しても失敗にはしない（exit 0）。ただ ✓ を出すと
      // 消えたように読めるので、! で「元から無い」と伝える。
      if (getConfigValue(key.field) == null) {
        printNotice(t("config.unsetNotSet", { key: name }));
        return;
      }
      unsetConfigValue(key.field);
      printSuccess(t("config.unsetDone", { key: name }));
    });
}
