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
import { t } from "../i18n/index.js";

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description(t("auth.desc"));

  auth
    .command("login")
    .description(t("auth.loginDesc"))
    .action(async () => {
      const oauth = getOAuthConfig();
      const tokens = await login(oauth);
      console.error(
        t("auth.loginSuccess", { backend: backendLabel(getBackend()) }),
      );
      if (tokens.scope) {
        console.error(t("auth.loginScope", { scope: tokens.scope }));
      }
    });

  auth
    .command("logout")
    .description(t("auth.logoutDesc"))
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
          console.error(t("auth.revokeFailed", { error: msg }));
        }
      }
      await deleteTokens();
      console.error(
        tokens != null ? t("auth.logoutDone") : t("auth.tokenDeleted"),
      );
    });

  auth
    .command("refresh")
    .description(t("auth.refreshDesc"))
    .action(async () => {
      const current = resolveAuth();
      if (current.method !== "oauth") {
        throw new Error(t("auth.notLoggedIn"));
      }
      const next = await refresh(getOAuthConfig(), current.tokens);
      console.error(
        t("auth.refreshDone", { backend: backendLabel(getBackend()) }),
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
    .description(t("auth.statusDesc"))
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
