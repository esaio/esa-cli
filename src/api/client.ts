import createClient, { type Client, type Middleware } from "openapi-fetch";
import { refresh } from "../auth/oauth.js";
import { resolveAuth } from "../auth/resolve-auth.js";
import { config, getOAuthConfig } from "../config/index.js";
import type { paths } from "../generated/api-types.js";

const RETRIED_HEADER = "x-esa-cli-retried";

/**
 * トークンを平文で送らないための最低限の防御。ESA_API_BASE_URL の誤設定で
 * http や第三者ホストへ Bearer トークンを送るのを防ぐ（localhost の http は
 * ローカル開発用に許容）。discovery 側の検証と方針を揃える。
 */
function validateApiBaseUrl(apiBaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error(
      `API のベース URL が不正です（ESA_API_BASE_URL を確認してください）: ${apiBaseUrl}`,
    );
  }
  if (url.protocol === "https:") return;
  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (url.protocol === "http:" && isLoopback) return;
  throw new Error(
    `API のベース URL は HTTPS である必要があります（localhost を除く）: ${apiBaseUrl}`,
  );
}

function applyAuth(headers: Headers): boolean {
  const auth = resolveAuth();
  if (auth.method === "oauth") {
    headers.set("Authorization", `Bearer ${auth.tokens.access_token}`);
    return true;
  }
  if (auth.method === "env") {
    headers.set("Authorization", `Bearer ${auth.token}`);
    return true;
  }
  return false;
}

const userAgentMiddleware: Middleware = {
  onRequest({ request }) {
    request.headers.set(
      "User-Agent",
      `esa-cli/${config.cli.version} (official)`,
    );
    return request;
  },
};

const authMiddleware: Middleware = {
  onRequest({ request }) {
    // 毎リクエスト時に解決する（下の refresh 後の更新を次リクエストへ反映するため）。
    if (!applyAuth(request.headers)) {
      throw new Error(
        "認証情報がありません。`esa auth login` でログインするか、ESA_ACCESS_TOKEN を設定してください。",
      );
    }
    return request;
  },

  async onResponse({ request, response }) {
    // OAuth のときだけ、401 で一度リフレッシュしてリトライする。
    if (response.status !== 401) return response;
    if (request.headers.get(RETRIED_HEADER)) return response;

    const auth = resolveAuth();
    if (auth.method !== "oauth") return response;

    try {
      await refresh(getOAuthConfig(), auth.tokens);
    } catch {
      return response; // リフレッシュ失敗時は元の 401 をそのまま返す
    }

    const retry = new Request(request, {
      headers: new Headers(request.headers),
    });
    retry.headers.set(RETRIED_HEADER, "1");
    applyAuth(retry.headers); // リフレッシュ後の新しいトークンを載せ直す
    // 生 fetch で送る（middleware を再度通さない = リトライは一度きり）。
    return fetch(retry);
  },

  onError({ error }) {
    // fetch 自体の失敗（DNS・タイムアウト等）を分かりやすいメッセージにする。
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(`esa API への接続に失敗しました: ${detail}`);
  },
};

/** esa API を叩く openapi-fetch クライアントを生成する。 */
export function createEsaClient(): Client<paths> {
  const { apiBaseUrl } = getOAuthConfig();
  validateApiBaseUrl(apiBaseUrl);
  const client = createClient<paths>({ baseUrl: apiBaseUrl });
  client.use(userAgentMiddleware);
  client.use(authMiddleware);
  return client;
}
