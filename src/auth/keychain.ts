import { execFileSync } from "node:child_process";

const SERVICE = "esa-cli";
const ACCOUNT = "oauth-tokens";

/** macOS Keychain (security コマンド) が利用可能か。 */
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
    return result.trim();
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
