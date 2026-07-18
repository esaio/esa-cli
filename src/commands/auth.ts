import type { Command } from "commander";
import { login, refresh, revoke } from "../auth/oauth.js";
import { resolveAuth } from "../auth/resolve-auth.js";
import {
  backendLabel,
  deleteTokens,
  getBackend,
  loadTokens,
} from "../auth/token-store.js";
import { getOAuthConfig } from "../config/index.js";

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command("auth")
    .description("Authenticate esa-cli with esa.io");

  auth
    .command("login")
    .description("Log in to esa.io via OAuth (browser)")
    .action(async () => {
      const oauth = getOAuthConfig();
      const tokens = await login(oauth);
      console.error(
        `認証に成功しました。トークンを ${backendLabel(getBackend())} に保存しました。`,
      );
      if (tokens.scope) {
        console.error(`許可されたスコープ: ${tokens.scope}`);
      }
    });

  auth
    .command("logout")
    .description("Log out and remove the stored token")
    .action(async () => {
      const tokens = loadTokens();

      // 失効はベストエフォート。ネットワーク障害などで失敗しても、
      // ローカルのトークン削除は必ず行う（端末紛失時に消せないと困る）。
      // tokens が null でも、パース不能な壊れたデータが残っている場合が
      // あるため削除は試みる（失効は tokens が無いと行えない）。
      if (tokens != null) {
        try {
          await revoke(getOAuthConfig(), tokens);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `トークンの失効に失敗しました（削除は続行します）: ${msg}`,
          );
        }
      }
      await deleteTokens();
      console.error(
        tokens != null
          ? "ログアウトしました。"
          : "保存されたトークンを削除しました。",
      );
    });

  auth
    .command("refresh")
    .description("Refresh the OAuth access token using the refresh token")
    .action(async () => {
      const current = resolveAuth();
      if (current.method !== "oauth") {
        throw new Error(
          "OAuth でログインしていません。`esa auth login` を実行してください。",
        );
      }
      const next = await refresh(getOAuthConfig(), current.tokens);
      console.error(
        `トークンを更新しました（${backendLabel(getBackend())}）。`,
      );
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = next.expires_at != null ? next.expires_at - now : null;
      console.log(
        JSON.stringify(
          {
            auth_method: "oauth",
            backend: getBackend(),
            token_type: next.token_type,
            scope: next.scope,
            has_refresh_token: Boolean(next.refresh_token),
            expired: expiresIn != null ? expiresIn <= 0 : null,
            expires_in_seconds:
              expiresIn != null ? Math.max(0, expiresIn) : null,
          },
          null,
          2,
        ),
      );
    });

  auth
    .command("status")
    .description("Show the current authentication status")
    .action(() => {
      const auth = resolveAuth();
      if (auth.method === "none") {
        console.log(JSON.stringify({ auth_method: "none" }, null, 2));
        return;
      }
      if (auth.method === "env") {
        console.log(
          JSON.stringify(
            { auth_method: "env", source: "ESA_ACCESS_TOKEN" },
            null,
            2,
          ),
        );
        return;
      }

      const { tokens } = auth;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn =
        tokens.expires_at != null ? tokens.expires_at - now : null;
      console.log(
        JSON.stringify(
          {
            auth_method: "oauth",
            backend: getBackend(),
            token_type: tokens.token_type,
            scope: tokens.scope,
            has_refresh_token: Boolean(tokens.refresh_token),
            expired: expiresIn != null ? expiresIn <= 0 : null,
            expires_in_seconds:
              expiresIn != null ? Math.max(0, expiresIn) : null,
          },
          null,
          2,
        ),
      );
    });
}
