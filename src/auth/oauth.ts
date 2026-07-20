import { type OAuthConfig, REQUEST_TIMEOUT_MS } from "../config/index.js";
import { t } from "../i18n/index.js";
import { fetchWithTimeout } from "../network/fetch.js";
import { startCallbackServer } from "./callback.js";
import { fetchMetadata } from "./discovery.js";
import { openBrowser } from "./open-browser.js";
import { generatePkce, generateState } from "./pkce.js";
import { saveTokens } from "./token-store.js";
import type { TokenSet } from "./types.js";

/** esa (Doorkeeper) のトークンエンドポイントのレスポンス。 */
type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  created_at?: number;
};

/**
 * RFC 6749 Section 6: リフレッシュ応答の refresh_token は任意で、
 * 含まれない場合は既存のものを使い続ける。
 */
function toTokenSet(
  data: TokenResponse,
  clientId: string,
  fallbackRefreshToken?: string,
): TokenSet {
  const expiresAt =
    data.created_at != null && data.expires_in != null
      ? data.created_at + data.expires_in
      : undefined;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? fallbackRefreshToken,
    token_type: data.token_type,
    scope: data.scope,
    expires_at: expiresAt,
    client_id: clientId,
  };
}

async function postForm(
  endpoint: string,
  params: URLSearchParams,
): Promise<Response> {
  return fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
    REQUEST_TIMEOUT_MS,
  );
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return `${response.status} ${response.statusText}${text ? `: ${text}` : ""}`;
}

/**
 * Authorization Code + PKCE フローでブラウザ認証を行い、
 * 取得したトークンを OS 資格情報ストアに保存する。
 */
export async function login(oauth: OAuthConfig): Promise<TokenSet> {
  console.error(t("oauth.fetchingMetadata"));
  const metadata = await fetchMetadata(oauth.apiBaseUrl);

  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const server = await startCallbackServer(state);

  try {
    const redirectUri = `http://127.0.0.1:${String(server.port)}/callback`;

    const authUrl = new URL(metadata.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", oauth.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", oauth.scope);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    console.error(t("oauth.openingBrowser"));
    console.error(t("oauth.openUrlManually", { url: authUrl.toString() }));
    openBrowser(authUrl.toString());

    console.error(t("oauth.waiting"));
    const code = await server.codePromise;

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("client_id", oauth.clientId);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", verifier);

    const response = await postForm(metadata.token_endpoint, params);
    if (!response.ok) {
      throw new Error(
        t("oauth.tokenFetchFailed", { error: await readError(response) }),
      );
    }

    const tokens = toTokenSet(
      (await response.json()) as TokenResponse,
      oauth.clientId,
    );
    await saveTokens(tokens);
    return tokens;
  } finally {
    server.close();
  }
}

/** refresh_token を使ってアクセストークンを更新し、保存する。 */
export async function refresh(
  oauth: OAuthConfig,
  tokens: TokenSet,
): Promise<TokenSet> {
  if (!tokens.refresh_token) {
    throw new Error(t("oauth.noRefreshToken"));
  }
  const metadata = await fetchMetadata(oauth.apiBaseUrl);

  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", tokens.refresh_token);
  params.set("client_id", tokens.client_id);

  const response = await postForm(metadata.token_endpoint, params);
  if (!response.ok) {
    throw new Error(
      t("oauth.tokenRefreshFailed", { error: await readError(response) }),
    );
  }

  const next = toTokenSet(
    (await response.json()) as TokenResponse,
    tokens.client_id,
    tokens.refresh_token,
  );
  await saveTokens(next);
  return next;
}

/**
 * アクセストークンと refresh_token を失効させる（ベストエフォート）。
 * 認可サーバーが失効エンドポイントを公開していない場合は何もしない。
 */
export async function revoke(
  oauth: OAuthConfig,
  tokens: TokenSet,
): Promise<void> {
  const metadata = await fetchMetadata(oauth.apiBaseUrl);
  const endpoint = metadata.revocation_endpoint;
  if (!endpoint) return;

  const revokeOne = (token: string): Promise<Response> => {
    const params = new URLSearchParams();
    params.set("token", token);
    params.set("client_id", tokens.client_id);
    return postForm(endpoint, params);
  };

  const targets = [tokens.access_token, tokens.refresh_token].filter(
    (t): t is string => Boolean(t),
  );
  await Promise.allSettled(targets.map(revokeOne));
}
