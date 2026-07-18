import { execFile } from "node:child_process";

/**
 * cmd の `start` は URL 中の `&` をコマンド区切りとして解釈してしまい、
 * クエリパラメータが最初の `&` で切り捨てられる。これを避けるため
 * PowerShell に base64 (UTF-16LE) で渡して起動する。
 * -EncodedCommand は .ps1 ではないので実行ポリシーの影響も受けない。
 */
function windowsCommand(url: string): [string, string[]] {
  const script = `Start-Process '${url.replace(/'/g, "''")}'`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return [
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
  ];
}

/**
 * 既定のブラウザで URL を開く（ベストエフォート）。
 * ネイティブ依存を避けるため OS 標準コマンドをシェル実行する。
 * 失敗しても例外は投げない（呼び出し側で URL を表示してフォールバックする）。
 */
export function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? (["open", [url]] as [string, string[]])
      : process.platform === "win32"
        ? windowsCommand(url)
        : (["xdg-open", [url]] as [string, string[]]);

  execFile(command, args, () => {
    // 失敗は無視する（URL を手動で開いてもらう）
  });
}
