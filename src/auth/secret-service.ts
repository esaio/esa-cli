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

function stderrOf(error: unknown): string {
  const { stderr } = error as { stderr?: Buffer | string };
  return (stderr ?? "").toString().trim();
}

/**
 * secret-tool の失敗を、そのまま原因が分かるメッセージに変換する。
 * キーリングがロックされている場合、secret-tool は
 * "Cannot create an item in a locked collection" を返して終了する。
 * 自動ログインを使っているとログインキーリングがアンロックされないため、
 * 実ユーザーでも普通に踏む。
 */
function describeSaveFailure(error: unknown): string {
  const stderr = stderrOf(error);
  const detail =
    stderr || (error instanceof Error ? error.message : String(error));

  if (/locked/i.test(stderr)) {
    return [
      detail,
      "キーリングがロックされています。「パスワードと鍵」(seahorse) でログインキーリングをアンロックするか、",
      "自動ログインを無効にしてログインし直してから、再度 `esa auth login` を実行してください。",
    ].join("\n");
  }
  return detail;
}

export function secretServiceSave(data: string): void {
  try {
    execFileSync(
      "secret-tool",
      ["store", "--label", SERVICE, "service", SERVICE, "account", ACCOUNT],
      { input: data, stdio: ["pipe", "ignore", "pipe"] },
    );
  } catch (error) {
    throw new Error(describeSaveFailure(error));
  }
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
