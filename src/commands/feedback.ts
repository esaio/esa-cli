import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";
import { config } from "../config/index.js";
import { t } from "../i18n/index.js";

type CreateOptions = {
  body?: string;
  bodyFile?: string;
  message?: string;
  messageFile?: string;
  team?: string;
};

/**
 * 本文を読む。--body / --message は同義（インライン）、--body-file / --message-file
 * も同義（ファイル、"-" で標準入力）。複数指定・未指定はエラー。
 */
function readMessage(options: CreateOptions): string {
  const inline = [options.body, options.message].filter((v) => v !== undefined);
  const file = [options.bodyFile, options.messageFile].filter(
    (v) => v !== undefined,
  );
  if (inline.length + file.length > 1) {
    throw new Error(t("feedback.messageConflict"));
  }
  if (inline.length === 1) return inline[0] as string;
  if (file.length === 1) {
    const path = file[0] as string;
    return readFileSync(path === "-" ? 0 : path, "utf-8");
  }
  throw new Error(t("feedback.messageRequired"));
}

/** 運営が仕分けしやすいよう、送信元クライアント（esa-cli）の情報を meta に添える。 */
function clientMeta(): Record<string, unknown> {
  return {
    client_name: "esa-cli",
    client_version: config.cli.version,
    os: process.platform,
    arch: process.arch,
  };
}

export function registerFeedbackCommand(program: Command): void {
  const feedback = program.command("feedback").description(t("feedback.desc"));

  feedback
    .command("create")
    .description(t("feedback.createDesc"))
    .option("-m, --message <text>", t("feedback.messageOpt"))
    .option("--message-file <path>", t("feedback.messageFileOpt"))
    .option("--body <text>", t("feedback.bodyOpt"))
    .option("--body-file <path>", t("feedback.bodyFileOpt"))
    .option("--team <name>", t("feedback.teamOpt"))
    .action(async (options: CreateOptions) => {
      // 入力の検証はネットワークより先に行う。
      const message = readMessage(options);
      const body = {
        message,
        meta: clientMeta(),
      };

      const client = createEsaClient();

      // --team を明示したときだけチームに紐づく。既定はチーム非依存の送信。
      if (options.team !== undefined) {
        const result = await client.POST("/v1/teams/{team_name}/feedbacks", {
          params: { path: { team_name: options.team } },
          body: { feedback: body },
        });
        unwrap(result);
      } else {
        const result = await client.POST("/v1/feedbacks", {
          body: { feedback: body },
        });
        unwrap(result);
      }

      // 送信成功（201・本文なし）。報告は人間向けなので stderr。
      console.error(t("feedback.sent"));
    });
}
