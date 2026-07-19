import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { currentLanguage, t } from "../i18n/index.js";

export type CallbackServer = {
  port: number;
  /** 認可コードを受け取る Promise。タイムアウト時は reject する。 */
  codePromise: Promise<string>;
  close: () => void;
};

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

/** 認証完了をブラウザに表示する HTML。lang 属性は現在の言語に合わせる。 */
function successHtml(): string {
  return `<!doctype html>
<html lang="${currentLanguage()}"><head><meta charset="utf-8"><title>esa CLI</title></head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 4rem;">
<h1>${t("callback.successTitle")}</h1>
<p>${t("callback.successBody")}</p>
</body></html>`;
}

/** ループバックのランダムポートで待ち受ける (RFC 8252)。 */
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
      res.end(t("callback.canceledBrowser", { error }));
      rejectCode(
        new Error(t("callback.canceledError", { error, description }).trim()),
      );
      return;
    }

    const state = url.searchParams.get("state");
    if (state !== expectedState) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(t("callback.stateMismatchBrowser"));
      rejectCode(new Error(t("callback.stateMismatchError")));
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(t("callback.noCodeBrowser"));
      rejectCode(new Error(t("callback.noCodeError")));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(successHtml());
    resolveCode(code);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const timeout = setTimeout(() => {
        server.close();
        rejectCode(new Error(t("callback.timeout")));
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
