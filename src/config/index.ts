import packageJson from "../../package.json" with { type: "json" };
import { t } from "../i18n/index.js";
import { isLoopbackHost } from "../network/loopback.js";

/** client_secret を持たない public client のため、公開しても問題ない値。 */
const DEFAULT_CLIENT_ID =
  "b29aa0a592d3eb6651db57a39994b57b2670613bd1b48b5937d97d34278bb133";

/**
 * esa-cli が提供するコマンドが必要とするスコープ一式。esa では read / write /
 * delete が別スコープなので、delete コマンドには delete:* が要る。revision は
 * 独立リソースで、post revisions に read:revision が要る。
 */
const DEFAULT_SCOPE = [
  "read:post",
  "write:post",
  "delete:post",
  "read:comment",
  "write:comment",
  "delete:comment",
  "read:category",
  "read:tag",
  "read:attachment",
  "write:attachment",
  "read:revision",
  "read:member",
  "read:team",
  "read:user",
  "write:feedback",
].join(" ");

export const config = {
  cli: {
    name: "esa",
    version: packageJson.version,
    // esa API リクエストの User-Agent。esa 側でクライアントを識別するため。
    userAgent: `esa-cli/${packageJson.version} (official)`,
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
function normalizeApiBaseUrl(apiBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error(t("baseUrl.invalid", { url: apiBaseUrl }));
  }

  // ws:// などで思わぬ通信をしないよう http/https に限定する。
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(t("baseUrl.notHttp", { url: apiBaseUrl }));
  }

  // base URL は後続で API パスと連結するため、query/hash/userinfo は許可しない。
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(t("baseUrl.invalid", { url: apiBaseUrl }));
  }

  const host = url.hostname;
  const isLoopback = isLoopbackHost(host);
  if (!isLoopback && !(host === "api.esa.io" && url.protocol === "https:")) {
    throw new Error(t("baseUrl.notAllowed", { url: apiBaseUrl }));
  }

  // openapi-fetch と discovery は base URL に "/v1/..." 等を連結するため、
  // 末尾の slash を除いて二重 slash を防ぐ。localhost の path prefix は保つ。
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}`;
}

export function getOAuthConfig(): OAuthConfig {
  const apiBaseUrl = config.esa.apiBaseUrl;
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  return {
    clientId: process.env.ESA_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID,
    scope: process.env.ESA_OAUTH_SCOPE || DEFAULT_SCOPE,
    apiBaseUrl: normalizedApiBaseUrl,
  };
}

/** OAuth フロー（メタデータ取得・トークン交換／更新）のタイムアウト（ミリ秒）。 */
export const OAUTH_REQUEST_TIMEOUT_MS = 10_000;

/**
 * 認証の完了・失敗後にブラウザを送る先。ESA_API_BASE_URL をローカルに
 * 差し替えて開発するときも本番を指すよう、独立した定数にする。
 */
export const OAUTH_SUCCESS_URL = "https://api.esa.io/oauth/cli/success";
export const OAUTH_FAILURE_URL = "https://api.esa.io/oauth/cli/failure";
