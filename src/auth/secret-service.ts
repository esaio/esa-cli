import { execFileSync } from "node:child_process";

const SERVICE = "esa-cli";
const ACCOUNT = "oauth-tokens";

/** Linux Secret Service (secret-tool コマンド) が利用可能か。 */
export function isSecretServiceAvailable(): boolean {
  if (process.platform !== "linux") return false;
  try {
    execFileSync("secret-tool", ["--help"], { stdio: "ignore" });
    return true;
  } catch (error) {
    // secret-tool --help は終了コード 2 を返すが、コマンド自体は存在する。
    // ENOENT のときだけ「存在しない」と判定する。
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }
    return true;
  }
}

export function secretServiceSave(data: string): void {
  execFileSync(
    "secret-tool",
    ["store", "--label", SERVICE, "service", SERVICE, "account", ACCOUNT],
    { input: data, stdio: ["pipe", "ignore", "ignore"] },
  );
}

export function secretServiceLoad(): string | null {
  try {
    const result = execFileSync(
      "secret-tool",
      ["lookup", "service", SERVICE, "account", ACCOUNT],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] },
    );
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function secretServiceDelete(): void {
  try {
    execFileSync(
      "secret-tool",
      ["clear", "service", SERVICE, "account", ACCOUNT],
      { stdio: "ignore" },
    );
  } catch {
    // エントリが存在しない場合は無視
  }
}
