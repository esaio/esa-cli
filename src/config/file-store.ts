import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR as DEFAULT_CONFIG_DIR } from "./paths.js";

const CONFIG_FILE = "config.json";

/** 設定ファイル (~/.config/esa-cli/config.json) の内容。トークンとは別ファイル。 */
export type FileConfig = {
  default_team?: string;
  language?: string;
};

export function readFileConfig(configDir = DEFAULT_CONFIG_DIR): FileConfig {
  let raw: string;
  try {
    raw = readFileSync(join(configDir, CONFIG_FILE), "utf-8");
  } catch (error) {
    // 未作成（ENOENT）は空設定として扱う。権限エラー等は握りつぶさず伝える。
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 壊れた JSON は空設定として扱い、処理を止めない。
    return {};
  }

  // 有効だが期待した形でない JSON（null・配列・プリミティブ、default_team が
  // 文字列以外）でも後続で TypeError にならないよう、形と型を検証して取り込む。
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }
  const record = parsed as Record<string, unknown>;
  const config: FileConfig = {};
  if (typeof record.default_team === "string") {
    config.default_team = record.default_team;
  }
  if (typeof record.language === "string") {
    config.language = record.language;
  }
  return config;
}

export function writeFileConfig(
  config: FileConfig,
  configDir = DEFAULT_CONFIG_DIR,
): void {
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(configDir, CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

export function getDefaultTeam(
  configDir = DEFAULT_CONFIG_DIR,
): string | undefined {
  return readFileConfig(configDir).default_team;
}

export function setDefaultTeam(
  team: string,
  configDir = DEFAULT_CONFIG_DIR,
): void {
  const config = readFileConfig(configDir);
  config.default_team = team;
  writeFileConfig(config, configDir);
}

export function getLanguage(
  configDir = DEFAULT_CONFIG_DIR,
): string | undefined {
  return readFileConfig(configDir).language;
}

export function setLanguage(
  language: string,
  configDir = DEFAULT_CONFIG_DIR,
): void {
  const config = readFileConfig(configDir);
  config.language = language;
  writeFileConfig(config, configDir);
}
