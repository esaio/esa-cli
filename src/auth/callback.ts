import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { OAUTH_FAILURE_URL, OAUTH_SUCCESS_URL } from "../config/index.js";
import { t } from "../i18n/index.js";

export type CallbackServer = {
  port: number;
  /** 認可コードを受け取る Promise。タイムアウト時は reject する。 */
  codePromise: Promise<string>;
  close: () => void;
};

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export type CallbackResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
  code?: string;
  error?: Error;
};

/** ブラウザを結果ページへ送る。Location は固定値で、クエリは引き継がない。 */
function redirect(location: string, error?: Error): CallbackResult {
  return {
    status: 302,
    headers: { Location: location, "Referrer-Policy": "no-referrer" },
    body: "",
    error,
  };
}

/** callback リクエストの URL と期待 state から、応答内容と結果を決める。 */
export function evaluateCallback(
  requestUrl: string,
  expectedState: string,
): CallbackResult {
  const url = new URL(requestUrl, "http://127.0.0.1");
  // favicon 取得やポートスキャンでログインを失敗させない。
  if (url.pathname !== "/callback") {
    return {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: t("callback.notFound"),
    };
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const description = url.searchParams.get("error_description") ?? "";
    return redirect(
      OAUTH_FAILURE_URL,
      new Error(
        t("callback.canceledError", {
          error: oauthError,
          description,
        }).trim(),
      ),
    );
  }

  const state = url.searchParams.get("state");
  if (state !== expectedState) {
    return redirect(
      OAUTH_FAILURE_URL,
      new Error(t("callback.stateMismatchError")),
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirect(OAUTH_FAILURE_URL, new Error(t("callback.noCodeError")));
  }

  // 認可レスポンスの受け取りはここで完了。以降の表示は RFC 8252 の範囲外。
  return { ...redirect(OAUTH_SUCCESS_URL), code };
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
    // 完了画面への遷移に失敗しても認証は成立させるため、応答より先に確定させる。
    if (result.error) rejectCode(result.error);
    else if (result.code) resolveCode(result.code);
    res.writeHead(result.status, result.headers);
    res.end(result.body);
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
