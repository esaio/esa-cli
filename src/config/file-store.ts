import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR as DEFAULT_CONFIG_DIR } from "./paths.js";

const CONFIG_FILE = "config.json";

/** 設定ファイル (~/.config/esa-cli/config.json) の内容。トークンとは別ファイル。 */
export type FileConfig = {
  default_team?: string;
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
  try {
    return JSON.parse(raw) as FileConfig;
  } catch {
    // 壊れた JSON は空設定として扱い、処理を止めない。
    return {};
  }
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
