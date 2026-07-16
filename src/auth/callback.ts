import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";

export type CallbackServer = {
  port: number;
  /** 認可コードを受け取る Promise。タイムアウト時は reject する。 */
  codePromise: Promise<string>;
  close: () => void;
};

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

const SUCCESS_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>esa CLI</title></head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 4rem;">
<h1>認証が完了しました</h1>
<p>このタブを閉じてターミナルに戻ってください。</p>
</body></html>`;

/**
 * 127.0.0.1 のランダムポートでコールバック用 HTTP サーバーを起動する。
 * /callback に届いた認可コードを検証して返す。
 */
export function startCallbackServer(
  expectedState: string,
): Promise<CallbackServer> {
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const error = url.searchParams.get("error");
    if (error) {
      const description = url.searchParams.get("error_description") ?? "";
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`認可がキャンセルされました: ${error}`);
      rejectCode(new Error(`認可エラー: ${error} ${description}`.trim()));
      return;
    }

    const state = url.searchParams.get("state");
    if (state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("state が一致しません");
      rejectCode(new Error("state が一致しません（CSRF の可能性）"));
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("認可コードがありません");
      rejectCode(new Error("認可コードが返されませんでした"));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(SUCCESS_HTML);
    resolveCode(code);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const timeout = setTimeout(() => {
        server.close();
        rejectCode(new Error("認証がタイムアウトしました（5分）"));
      }, CALLBACK_TIMEOUT_MS);

      resolve({
        port,
        codePromise,
        close: () => {
          clearTimeout(timeout);
          server.close();
        },
      });
    });
  });
}
