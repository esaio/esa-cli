import createClient, { type Client, type Middleware } from "openapi-fetch";
import { refresh } from "../auth/oauth.js";
import { type ResolvedAuth, resolveAuth } from "../auth/resolve-auth.js";
import type { TokenSet } from "../auth/types.js";
import { config, getOAuthConfig, REQUEST_TIMEOUT_MS } from "../config/index.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { fetchWithTimeout } from "../network/fetch.js";

// 期限のこの秒数前になったら、送信前にトークンを更新する。
const REFRESH_MARGIN_SECONDS = 60;

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
    request.headers.set("User-Agent", config.cli.userAgent);
    return request;
  },
};

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const auth = resolveAuth();
    let token = bearerOf(auth);
    if (token == null) {
      throw new Error(t("apiClient.noAuth"));
    }

    // OAuth は期限切れで 401 になる前に、送信前に更新する（プロアクティブ）。
    // env トークンは更新できないので対象外。
    if (auth.method === "oauth" && isExpiring(auth.tokens)) {
      try {
        const next = await refresh(getOAuthConfig(), auth.tokens);
        token = next.access_token;
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
    return new Error(t("apiClient.connectionFailed", { error: detail }));
  },
};

/** esa API を叩く openapi-fetch クライアントを生成する。 */
export function createEsaClient(): Client<paths> {
  const { apiBaseUrl } = getOAuthConfig(); // apiBaseUrl はここで検証される
  const client = createClient<paths>({
    baseUrl: apiBaseUrl,
    fetch: (input: Request) =>
      fetchWithTimeout(input, undefined, REQUEST_TIMEOUT_MS),
  });
  client.use(userAgentMiddleware);
  client.use(authMiddleware);
  return client;
}
