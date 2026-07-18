import { createHash, randomBytes } from "node:crypto";

export type Pkce = {
  verifier: string;
  challenge: string;
};

/** PKCE (RFC 7636) の code_verifier と S256 の code_challenge を生成する。 */
export function generatePkce(): Pkce {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** CSRF 対策の state パラメータを生成する。 */
export function generateState(): string {
  return randomBytes(16).toString("base64url");
}
