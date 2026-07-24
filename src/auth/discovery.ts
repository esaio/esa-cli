import { OAUTH_REQUEST_TIMEOUT_MS } from "../config/index.js";
import { t } from "../i18n/index.js";
import { fetchWithTimeout } from "../network/fetch.js";
import { isLoopbackHost } from "../network/loopback.js";

/** OAuth 2.0 Authorization Server Metadata (RFC 8414) のうち利用する範囲。 */
export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
};

const WELL_KNOWN_PATH = "/.well-known/oauth-authorization-server";

let cache: { key: string; metadata: AuthorizationServerMetadata } | undefined;

// メタデータが差し替えられた場合にトークンを平文で送らないための最低限の防御。
function validateEndpoint(
  value: string,
  field: string,
  allowHttp: boolean,
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(t("discovery.notUrl", { field, value }));
  }
  if (url.protocol !== "https:" && !allowHttp) {
    throw new Error(t("discovery.notHttps", { field, value }));
  }
}

function requireEndpoint(
  metadata: Record<string, unknown>,
  field: string,
  allowHttp: boolean,
): string {
  const value = metadata[field];
  if (typeof value !== "string" || value === "") {
    throw new Error(t("discovery.missingField", { field }));
  }
  validateEndpoint(value, field, allowHttp);
  return value;
}

/** 任意のエンドポイント。存在する場合のみ URL/HTTPS を検証する。 */
function optionalEndpoint(
  metadata: Record<string, unknown>,
  field: string,
  allowHttp: boolean,
): string | undefined {
  const value = metadata[field];
  if (typeof value !== "string" || value === "") return undefined;
  validateEndpoint(value, field, allowHttp);
  return value;
}

/**
 * ローカル開発の dev サーバは metadata に https の endpoint を広告するが、実際は
 * loopback の http で待ち受ける。base URL が http のとき（normalizeApiBaseUrl に
 * より loopback に限定される）は、loopback ホストの endpoint を http に落として
 * dev サーバに到達できるようにする。remote ホストの https はそのまま保つ。
 */
function toLoopbackHttp(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && isLoopbackHost(url.hostname)) {
      url.protocol = "http:";
      return url.toString();
    }
  } catch {
    // URL として解釈できなければそのまま返し、後段の検証に委ねる。
  }
  return value;
}

/**
 * esa の metadata は issuer が `https://esa.io/` だが、配信は
 * `https://api.esa.io/.well-known/...` のみ（issuer のホストでは 404）。
 * このため RFC 8414 の「issuer のオリジンから取得し issuer の完全一致を
 * 検証する」方式は使えない。
 */
export async function fetchMetadata(
  apiBaseUrl: string,
): Promise<AuthorizationServerMetadata> {
  if (cache?.key === apiBaseUrl) return cache.metadata;

  let base: URL;
  try {
    base = new URL(apiBaseUrl);
  } catch {
    throw new Error(t("baseUrl.invalid", { url: apiBaseUrl }));
  }

  const url = `${apiBaseUrl}${WELL_KNOWN_PATH}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      { headers: { Accept: "application/json" } },
      OAUTH_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(t("discovery.fetchFailed", { url, error: msg }));
  }
  if (!response.ok) {
    throw new Error(
      t("discovery.fetchFailed", {
        url,
        error: `${response.status} ${response.statusText}`,
      }),
    );
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const allowHttp = base.protocol === "http:";
  // http base（loopback のローカル開発）では、広告された https endpoint を
  // http に落として dev サーバに届かせる。本番（https base）では素通し。
  const rewrite = allowHttp ? toLoopbackHttp : (value: string) => value;

  const revocation = optionalEndpoint(raw, "revocation_endpoint", allowHttp);
  const metadata: AuthorizationServerMetadata = {
    issuer: typeof raw.issuer === "string" ? raw.issuer : "",
    authorization_endpoint: rewrite(
      requireEndpoint(raw, "authorization_endpoint", allowHttp),
    ),
    token_endpoint: rewrite(requireEndpoint(raw, "token_endpoint", allowHttp)),
    revocation_endpoint:
      revocation === undefined ? undefined : rewrite(revocation),
    code_challenge_methods_supported: Array.isArray(
      raw.code_challenge_methods_supported,
    )
      ? (raw.code_challenge_methods_supported as string[])
      : undefined,
    token_endpoint_auth_methods_supported: Array.isArray(
      raw.token_endpoint_auth_methods_supported,
    )
      ? (raw.token_endpoint_auth_methods_supported as string[])
      : undefined,
  };

  // この CLI は PKCE(S256) 固定で認証するため、非対応なら早期に失敗させる。
  const pkceMethods = metadata.code_challenge_methods_supported;
  if (pkceMethods && !pkceMethods.includes("S256")) {
    throw new Error(
      t("discovery.pkceUnsupported", { methods: pkceMethods.join(", ") }),
    );
  }

  cache = { key: apiBaseUrl, metadata };
  return metadata;
}

/** @internal テスト用: メタデータのキャッシュを破棄する。 */
export function clearMetadataCache(): void {
  cache = undefined;
}
