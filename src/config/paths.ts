import { homedir } from "node:os";
import { join } from "node:path";

/** esa-cli の設定・トークンの保存先ディレクトリ。 */
export const CONFIG_DIR = join(homedir(), ".config", "esa-cli");
