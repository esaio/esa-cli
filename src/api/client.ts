import createClient, { type Client, type Middleware } from "openapi-fetch";
import { refresh } from "../auth/oauth.js";
import { resolveAuth } from "../auth/resolve-auth.js";
import { getOAuthConfig } from "../config/index.js";
import type { paths } from "../generated/api-types.js";

const RETRIED_HEADER = "x-esa-cli-retried";

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
    applyAuth(retry.headers);
    // 生 fetch で送る（middleware を再度通さない = リトライは一度きり）。
    return fetch(retry);
  },
};

/** esa API を叩く openapi-fetch クライアントを生成する。 */
export function createEsaClient(): Client<paths> {
  const { apiBaseUrl } = getOAuthConfig();
  const client = createClient<paths>({ baseUrl: apiBaseUrl });
  client.use(authMiddleware);
  return client;
}
