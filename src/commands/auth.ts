import type { Command } from "commander";
import { login, revoke } from "../auth/oauth.js";
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
      if (tokens == null) {
        console.error("ログインしていません。");
        return;
      }
      const oauth = getOAuthConfig();
      await revoke(oauth, tokens);
      await deleteTokens();
      console.error("ログアウトしました。");
    });

  auth
    .command("status")
    .description("Show the current authentication status")
    .action(() => {
      const tokens = loadTokens();
      if (tokens == null) {
        if (process.env.ESA_ACCESS_TOKEN) {
          console.log(
            JSON.stringify(
              { auth_method: "env", source: "ESA_ACCESS_TOKEN" },
              null,
              2,
            ),
          );
          return;
        }
        console.log(JSON.stringify({ auth_method: "none" }, null, 2));
        return;
      }

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
              expiresIn != null && expiresIn > 0 ? expiresIn : 0,
          },
          null,
          2,
        ),
      );
    });
}
