import type { Command } from "commander";
import {
  getDefaultTeam,
  getLanguage,
  setDefaultTeam,
  setLanguage,
} from "../config/file-store.js";
import { t } from "../i18n/index.js";
import { SUPPORTED_LANGUAGES } from "../i18n/resolve-language.js";
import { printSuccess } from "../output/mutation.js";

const KEY_DEFAULT_TEAM = "default-team";
const KEY_LANGUAGE = "language";
const KNOWN_KEYS = [KEY_DEFAULT_TEAM, KEY_LANGUAGE];
const KEY_LIST = KNOWN_KEYS.join(" / ");

function assertKnownKey(key: string): void {
  if (!KNOWN_KEYS.includes(key)) {
    throw new Error(t("config.unknownKey", { key, keys: KEY_LIST }));
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program.command("config").description(t("config.desc"));

  config
    .command("set")
    .argument("<key>", t("config.keyArg", { keys: KEY_LIST }))
    .argument("<value>", t("config.valueArg"))
    .description(t("config.setDesc"))
    .action((key: string, value: string) => {
      assertKnownKey(key);
      // 前後の空白を除き、空文字は保存しない（resolveTeam の trim と揃える）。
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error(t("config.emptyValue", { key }));
      }
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
}
