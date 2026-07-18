import { loadTokens } from "./token-store.js";
import type { TokenSet } from "./types.js";

export type ResolvedAuth =
  | { method: "oauth"; tokens: TokenSet }
  | { method: "env"; token: string }
  | { method: "none" };

/**
 * 使用する認証方式を決める。OAuth ログイン済みトークンを最優先し、
 * 無ければ ESA_ACCESS_TOKEN、どちらも無ければ none。
 * client の認証ヘッダ組み立てと `auth status` の表示がこれを共有する。
 */
export function resolveAuth(): ResolvedAuth {
  const tokens = loadTokens();
  if (tokens) return { method: "oauth", tokens };

  const token = process.env.ESA_ACCESS_TOKEN;
  if (token) return { method: "env", token };

  return { method: "none" };
}
