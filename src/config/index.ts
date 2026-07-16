/**
 * esa の public app（PKCE を用いる public client）の client_id。
 * client_secret を持たないため公開しても問題ない値。
 * ESA_OAUTH_CLIENT_ID で上書きできる。
 */
const DEFAULT_CLIENT_ID =
  "b29aa0a592d3eb6651db57a39994b57b2670613bd1b48b5937d97d34278bb133";

/**
 * login でデフォルト要求するスコープ。post 操作を中心とした実用セット。
 * ESA_OAUTH_SCOPE で上書きできる。
 */
const DEFAULT_SCOPE = [
  "read:post",
  "write:post",
  "read:comment",
  "write:comment",
  "read:category",
  "read:tag",
  "read:member",
  "read:team",
  "read:user",
].join(" ");

export const config = {
  cli: {
    name: "esa",
    description: "Official CLI for esa.io",
    version: "0.0.1",
  },
  esa: {
    apiAccessToken: process.env.ESA_ACCESS_TOKEN || "",
    apiBaseUrl: process.env.ESA_API_BASE_URL || "https://api.esa.io",
  },
} as const;

export type OAuthConfig = {
  clientId: string;
  scope: string;
  /** 認可サーバーのメタデータ (RFC 8414) の取得元。 */
  apiBaseUrl: string;
};

/**
 * OAuth 認証に必要な設定を解決して返す。
 *
 * 各エンドポイントはここでは持たない。実行時に discovery
 * (`/.well-known/oauth-authorization-server`) から取得する。
 */
export function getOAuthConfig(): OAuthConfig {
  return {
    clientId: process.env.ESA_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID,
    scope: process.env.ESA_OAUTH_SCOPE || DEFAULT_SCOPE,
    apiBaseUrl: config.esa.apiBaseUrl,
  };
}
