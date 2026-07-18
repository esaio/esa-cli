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
 * トークンを平文で送らないための最低限の防御。ESA_API_BASE_URL の誤設定で
 * http や第三者ホストへ Bearer トークン・refresh_token を送るのを防ぐ
 * （localhost の http はローカル開発用に許容）。ここで検証することで、
 * API クライアントと auth コマンド（login/logout/refresh）の両方が守られる。
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
