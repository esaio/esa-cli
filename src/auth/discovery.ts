import { REQUEST_TIMEOUT_MS } from "../config/index.js";

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
    throw new Error(
      `認可サーバーのメタデータの ${field} が URL ではありません: ${value}`,
    );
  }
  if (url.protocol !== "https:" && !allowHttp) {
    throw new Error(`${field} は HTTPS である必要があります: ${value}`);
  }
}

function requireEndpoint(
  metadata: Record<string, unknown>,
  field: string,
  allowHttp: boolean,
): string {
  const value = metadata[field];
  if (typeof value !== "string" || value === "") {
    throw new Error(`認可サーバーのメタデータに ${field} がありません`);
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
    throw new Error(
      `API のベース URL が不正です（ESA_API_BASE_URL を確認してください）: ${apiBaseUrl}`,
    );
  }

  const url = `${apiBaseUrl}${WELL_KNOWN_PATH}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `認可サーバーのメタデータを取得できませんでした (${url}): ${msg}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `認可サーバーのメタデータを取得できませんでした (${url}): ${response.status} ${response.statusText}`,
    );
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const allowHttp = base.protocol === "http:";

  const metadata: AuthorizationServerMetadata = {
    issuer: typeof raw.issuer === "string" ? raw.issuer : "",
    authorization_endpoint: requireEndpoint(
      raw,
      "authorization_endpoint",
      allowHttp,
    ),
    token_endpoint: requireEndpoint(raw, "token_endpoint", allowHttp),
    revocation_endpoint: optionalEndpoint(
      raw,
      "revocation_endpoint",
      allowHttp,
    ),
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
      `認可サーバーが PKCE (S256) に対応していません: ${pkceMethods.join(", ")}`,
    );
  }

  cache = { key: apiBaseUrl, metadata };
  return metadata;
}

/** @internal テスト用: メタデータのキャッシュを破棄する。 */
export function clearMetadataCache(): void {
  cache = undefined;
}
