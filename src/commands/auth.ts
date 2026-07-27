import type { Command } from "commander";
import { login, refresh, revoke } from "../auth/oauth.js";
import { type ResolvedAuth, resolveAuth } from "../auth/resolve-auth.js";
import {
  backendLabel,
  deleteTokens,
  getBackend,
  loadTokens,
} from "../auth/token-store.js";
import { config, getOAuthConfig } from "../config/index.js";
import { t } from "../i18n/index.js";
import { bold, dim, green, red } from "../output/color.js";
import { fieldLine } from "../output/detail.js";
import { printJson } from "../output/json-fields.js";
import { printJsonAfterChange, printSuccess } from "../output/mutation.js";
import { relativeTime } from "../output/time.js";

/** 見出しに出す接続先ホスト。base URL が不正でもここでは落とさない。 */
function apiHost(): string {
  try {
    return new URL(config.esa.apiBaseUrl).hostname;
  } catch {
    return config.esa.apiBaseUrl;
  }
}

/** 保存済みトークンの状態。--json で絞り込む対象になる。 */
function statusRecord(
  auth: ResolvedAuth,
  now: Date = new Date(),
): Record<string, unknown> {
  if (auth.method === "none") return { auth_method: "none" };
  if (auth.method === "env") {
    return { auth_method: "env", source: "ESA_ACCESS_TOKEN" };
  }

  const { tokens } = auth;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const expiresIn =
    tokens.expires_at != null ? tokens.expires_at - nowSeconds : null;
  return {
    auth_method: "oauth",
    backend: getBackend(),
    token_type: tokens.token_type,
    scope: tokens.scope,
    has_refresh_token: Boolean(tokens.refresh_token),
    expired: expiresIn != null ? expiresIn <= 0 : null,
    expires_in_seconds: expiresIn != null ? Math.max(0, expiresIn) : null,
  };
}

/**
 * 認証状態を人間向けに組み立てる。出力先で形は変えない（状態の報告であって
 * 取り出して使うレコードではないため）。機械可読な形が要る場合は --json を使う。
 * 判断に使う情報は --json と揃えるが、token_type は常に Bearer で読み手に
 * 情報を足さないため省く。
 */
function renderStatus(auth: ResolvedAuth, now: Date = new Date()): string {
  const host = apiHost();
  const lines = [bold(host)];
  const item = (label: string, value: string) =>
    lines.push(fieldLine(label, value));

  if (auth.method === "none") {
    lines.push(`  ${red("X")} ${t("auth.statusNotLoggedIn", { host })}`);
    // ラベルと値の対ではなく案内文なので、項目行の組み立ては使わない。
    lines.push(`  ${dim("-")} ${t("auth.statusLoginHint")}`);
    return lines.join("\n");
  }

  if (auth.method === "env") {
    lines.push(`  ${green("✓")} ${t("auth.statusLoggedInEnv", { host })}`);
    return lines.join("\n");
  }

  const { tokens } = auth;
  lines.push(
    `  ${green("✓")} ${t("auth.statusLoggedIn", {
      host,
      backend: backendLabel(getBackend()),
    })}`,
  );
  if (tokens.scope) {
    const scopes = tokens.scope
      .split(" ")
      .filter((scope) => scope.length > 0)
      .map((scope) => `'${scope}'`)
      .join(", ");
    item(t("auth.statusScopes"), scopes);
  }
  if (tokens.expires_at != null) {
    const expiresAt = new Date(tokens.expires_at * 1000);
    item(
      t("auth.statusExpires"),
      expiresAt.getTime() <= now.getTime()
        ? red(t("auth.statusExpired"))
        : relativeTime(expiresAt.toISOString(), now),
    );
  }
  item(
    t("auth.statusRefreshToken"),
    tokens.refresh_token ? t("auth.statusYes") : t("auth.statusNo"),
  );
  return lines.join("\n");
}

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
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: { json?: string | true }) => {
      const current = resolveAuth();
      if (current.method !== "oauth") {
        throw new Error(t("auth.notLoggedIn"));
      }
      const next = await refresh(getOAuthConfig(), current.tokens);
      // 新しいリソースは生まれないので stdout は空のままにする（削除と同じ）。
      printSuccess(
        t("auth.refreshDone", { backend: backendLabel(getBackend()) }),
      );
      if (options.json !== undefined) {
        // 更新は済んでいるので、絞り込みの失敗でコマンドを失敗させない。
        printJsonAfterChange(
          statusRecord({ method: "oauth", tokens: next }),
          options.json,
        );
      }
    });

  auth
    .command("status")
    .description(t("auth.statusDesc"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action((options: { json?: string | true }) => {
      const auth = resolveAuth();

      if (options.json !== undefined) {
        printJson(statusRecord(auth), options.json);
        return;
      }
      console.log(renderStatus(auth));
    });
}
