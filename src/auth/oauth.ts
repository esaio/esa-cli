import type { OAuthConfig } from "../config/index.js";
import { startCallbackServer } from "./callback.js";
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

function toTokenSet(data: TokenResponse, clientId: string): TokenSet {
  const expiresAt =
    data.created_at != null && data.expires_in != null
      ? data.created_at + data.expires_in
      : undefined;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
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
  return fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
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
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const server = await startCallbackServer(state);

  try {
    const redirectUri = `http://127.0.0.1:${String(server.port)}/callback`;

    const authUrl = new URL(oauth.authorizationEndpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", oauth.clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", oauth.scope);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    console.error("ブラウザで認可画面を開きます...");
    console.error(`開かない場合は次の URL を開いてください:\n${authUrl}\n`);
    openBrowser(authUrl.toString());

    console.error("ブラウザでの認可を待機しています...");
    const code = await server.codePromise;

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("client_id", oauth.clientId);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", verifier);

    const response = await postForm(oauth.tokenEndpoint, params);
    if (!response.ok) {
      throw new Error(
        `トークンの取得に失敗しました: ${await readError(response)}`,
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
    throw new Error("refresh_token がありません。再ログインしてください。");
  }
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", tokens.refresh_token);
  params.set("client_id", tokens.client_id);

  const response = await postForm(oauth.tokenEndpoint, params);
  if (!response.ok) {
    throw new Error(
      `トークンの更新に失敗しました: ${await readError(response)}`,
    );
  }

  const next = toTokenSet(
    (await response.json()) as TokenResponse,
    tokens.client_id,
  );
  await saveTokens(next);
  return next;
}

/** アクセストークンと refresh_token を失効させる（ベストエフォート）。 */
export async function revoke(
  oauth: OAuthConfig,
  tokens: TokenSet,
): Promise<void> {
  const revokeOne = (token: string): Promise<Response> => {
    const params = new URLSearchParams();
    params.set("token", token);
    params.set("client_id", tokens.client_id);
    return postForm(oauth.revocationEndpoint, params);
  };

  const targets = [tokens.access_token, tokens.refresh_token].filter(
    (t): t is string => Boolean(t),
  );
  await Promise.allSettled(targets.map(revokeOne));
}
