/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)。
 * esa が公開しているもののうち、CLI が利用するフィールドのみ定義する。
 */
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

function requireEndpoint(
  metadata: Record<string, unknown>,
  field: string,
  allowHttp: boolean,
): string {
  const value = metadata[field];
  if (typeof value !== "string" || value === "") {
    throw new Error(`認可サーバーのメタデータに ${field} がありません`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `認可サーバーのメタデータの ${field} が URL ではありません: ${value}`,
    );
  }
  // メタデータが差し替えられた場合にトークンを平文で送らないための最低限の防御。
  if (url.protocol !== "https:" && !allowHttp) {
    throw new Error(`${field} は HTTPS である必要があります: ${value}`);
  }
  return value;
}

/**
 * 認可サーバーのメタデータを取得する。
 *
 * esa の metadata は issuer が `https://esa.io/` である一方、実体は
 * `https://api.esa.io/.well-known/...` で配信されている（issuer のホストでは
 * 配信されていない）。そのため RFC 8414 の「issuer のオリジンから取得して
 * issuer の完全一致を検証する」方式は使えず、API のベース URL から取得する。
 */
export async function fetchMetadata(
  apiBaseUrl: string,
): Promise<AuthorizationServerMetadata> {
  if (cache?.key === apiBaseUrl) return cache.metadata;

  const url = `${apiBaseUrl}${WELL_KNOWN_PATH}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
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
  const allowHttp = new URL(apiBaseUrl).protocol === "http:";

  const metadata: AuthorizationServerMetadata = {
    issuer: typeof raw.issuer === "string" ? raw.issuer : "",
    authorization_endpoint: requireEndpoint(
      raw,
      "authorization_endpoint",
      allowHttp,
    ),
    token_endpoint: requireEndpoint(raw, "token_endpoint", allowHttp),
    revocation_endpoint:
      typeof raw.revocation_endpoint === "string"
        ? raw.revocation_endpoint
        : undefined,
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

  // この CLI は client_secret を持たない public client として PKCE(S256) 固定で
  // 認証するため、サーバー側が対応していないなら早期に失敗させる。
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
