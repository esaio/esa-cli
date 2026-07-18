import createClient, { type Client, type Middleware } from "openapi-fetch";
import { refresh } from "../auth/oauth.js";
import { type ResolvedAuth, resolveAuth } from "../auth/resolve-auth.js";
import type { TokenSet } from "../auth/types.js";
import { config, getOAuthConfig } from "../config/index.js";
import type { paths } from "../generated/api-types.js";

// 期限のこの秒数前になったら、送信前にトークンを更新する。
const REFRESH_MARGIN_SECONDS = 60;

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

function isExpiring(tokens: TokenSet): boolean {
  if (tokens.expires_at == null) return false; // 期限不明なら更新しない
  const now = Math.floor(Date.now() / 1000);
  return tokens.expires_at - now <= REFRESH_MARGIN_SECONDS;
}

function bearerOf(auth: ResolvedAuth): string | null {
  if (auth.method === "oauth") return auth.tokens.access_token;
  if (auth.method === "env") return auth.token;
  return null;
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
  async onRequest({ request }) {
    const auth = resolveAuth();
    let token = bearerOf(auth);
    if (token == null) {
      throw new Error(
        "認証情報がありません。`esa auth login` でログインするか、ESA_ACCESS_TOKEN を設定してください。",
      );
    }

    // OAuth は期限切れで 401 になる前に、送信前に更新する（プロアクティブ）。
    // env トークンは更新できないので対象外。
    if (auth.method === "oauth" && isExpiring(auth.tokens)) {
      try {
        await refresh(getOAuthConfig(), auth.tokens);
        const refreshed = bearerOf(resolveAuth());
        if (refreshed != null) token = refreshed;
      } catch {
        // 更新できなくても現トークンで送り、サーバーの判断に委ねる。
      }
    }

    request.headers.set("Authorization", `Bearer ${token}`);
    return request;
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
