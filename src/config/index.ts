import packageJson from "../../package.json" with { type: "json" };

/** client_secret を持たない public client のため、公開しても問題ない値。 */
const DEFAULT_CLIENT_ID =
  "b29aa0a592d3eb6651db57a39994b57b2670613bd1b48b5937d97d34278bb133";

/** post 操作を中心とした実用セット。delete 系は含めない。 */
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
    version: packageJson.version,
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
 * Bearer トークンや refresh_token を第三者ホストへ送らないための防御。
 * ESA_API_BASE_URL は esa 本番（HTTPS）か、ローカル開発用の loopback ホスト
 * のみ許可する。ホスト名で判定するため userinfo 偽装
 * （https://api.esa.io@evil.com は hostname が evil.com）も弾ける。
 * ここで検証することで、API クライアントと auth コマンド
 * （login/logout/refresh）の両方が守られる。
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

  const host = url.hostname;
  // RFC 6761: localhost とそのサブドメインは loopback に解決される。
  const isLoopback =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]";
  if (isLoopback) return; // ローカル開発（http/https どちらも可）

  if (host === "api.esa.io" && url.protocol === "https:") return;

  throw new Error(
    `許可されていない API のベース URL です（api.esa.io または localhost のみ）: ${apiBaseUrl}`,
  );
}

export function getOAuthConfig(): OAuthConfig {
  const apiBaseUrl = config.esa.apiBaseUrl;
  validateApiBaseUrl(apiBaseUrl);
  return {
    clientId: process.env.ESA_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID,
    scope: process.env.ESA_OAUTH_SCOPE || DEFAULT_SCOPE,
    apiBaseUrl,
  };
}

/** ネットワークリクエストのタイムアウト（ミリ秒）。無応答時のハングを防ぐ。 */
export const REQUEST_TIMEOUT_MS = 10_000;
