import { execFileSync } from "node:child_process";

const SERVICE = "esa-cli";
const ACCOUNT = "oauth-tokens";

/**
 * macOS Keychain (security コマンド) が利用可能か。
 *
 * `security help` は正常環境では必ず成功するため、理由を問わず失敗したら
 * 利用不可とみなして次の backend にフォールバックする。
 * (ENOENT のみを見る secret-service とは方針が異なる。あちらは
 *  `secret-tool --help` が正常時でも終了コード 2 を返すための特例。)
 */
export function isKeychainAvailable(): boolean {
  if (process.platform !== "darwin") return false;
  try {
    execFileSync("security", ["help"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function keychainSave(data: string): void {
  execFileSync(
    "security",
    ["add-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w", data, "-U"],
    { stdio: "ignore" },
  );
}

/** エントリが無い場合・値が空の場合はいずれも null を返す。 */
export function keychainLoad(): string | null {
  try {
    const result = execFileSync(
      "security",
      ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    );
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function keychainDelete(): void {
  try {
    execFileSync(
      "security",
      ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT],
      { stdio: "ignore" },
    );
  } catch {
    // エントリが存在しない場合は無視
  }
}
