import { execFileSync } from "node:child_process";

const SERVICE = "esa-cli";
const ACCOUNT = "oauth-tokens";

/**
 * `security help` は正常な環境なら必ず成功するため、失敗したら理由を問わず
 * 利用不可とみなして次の backend にフォールバックする。
 * (ENOENT のみを見る secret-service とは方針が異なる。)
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
