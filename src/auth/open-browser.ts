import { execFile } from "node:child_process";

/**
 * 既定のブラウザで URL を開く（ベストエフォート）。
 * ネイティブ依存を避けるため OS 標準コマンドをシェル実行する。
 * 失敗しても例外は投げない（呼び出し側で URL を表示してフォールバックする）。
 */
export function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];

  execFile(command, args, () => {
    // 失敗は無視する（URL を手動で開いてもらう）
  });
}
