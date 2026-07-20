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

export type CallbackResult = {
  status: number;
  contentType: string;
  body: string;
  code?: string;
  error?: Error;
};

/** 認証完了をブラウザに表示する HTML。lang 属性は現在の言語に合わせる。 */
function successHtml(): string {
  return `<!doctype html>
<html lang="${currentLanguage()}"><head><meta charset="utf-8"><title>esa CLI</title></head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 4rem;">
<h1>${t("callback.successTitle")}</h1>
<p>${t("callback.successBody")}</p>
</body></html>`;
}

/** callback リクエストの URL と期待 state から、応答内容と結果を決める。 */
export function evaluateCallback(
  requestUrl: string,
  expectedState: string,
): CallbackResult {
  const url = new URL(requestUrl, "http://127.0.0.1");
  if (url.pathname !== "/callback") {
    return {
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: t("callback.notFound"),
    };
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const description = url.searchParams.get("error_description") ?? "";
    return {
      status: 400,
      contentType: "text/plain; charset=utf-8",
      body: t("callback.canceledBrowser", { error: oauthError }),
      error: new Error(
        t("callback.canceledError", {
          error: oauthError,
          description,
        }).trim(),
      ),
    };
  }

  const state = url.searchParams.get("state");
  if (state !== expectedState) {
    return {
      status: 400,
      contentType: "text/plain; charset=utf-8",
      body: t("callback.stateMismatchBrowser"),
      error: new Error(t("callback.stateMismatchError")),
    };
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return {
      status: 400,
      contentType: "text/plain; charset=utf-8",
      body: t("callback.noCodeBrowser"),
      error: new Error(t("callback.noCodeError")),
    };
  }

  return {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: successHtml(),
    code,
  };
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
    const result = evaluateCallback(req.url ?? "/", expectedState);
    res.writeHead(result.status, { "Content-Type": result.contentType });
    res.end(result.body);
    if (result.error) rejectCode(result.error);
    else if (result.code) resolveCode(result.code);
  });

  return new Promise((resolve, reject) => {
    const onListenError = (error: Error) => reject(error);
    server.once("error", onListenError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onListenError);
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
