import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { type BodyOptions, requireBody } from "./body-input.js";
import { confirm } from "./confirm.js";
import { positiveInt } from "./parse.js";

type CommentsQuery = NonNullable<
  paths["/v1/teams/{team_name}/comments"]["get"]["parameters"]["query"]
>;

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** 削除確認用に本文の先頭行を短く整える。 */
function preview(body: string): string {
  const firstLine = body.split("\n")[0] ?? "";
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

export function registerCommentCommand(program: Command): void {
  const comment = program.command("comment").description(t("comment.desc"));

  type ListOptions = {
    team?: string;
    post?: string;
    page?: string;
    perPage?: string;
  };

  comment
    .command("list")
    .description(t("comment.listDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--post <number>", t("comment.listPostOpt"))
    .option("--page <number>", t("comment.pageOpt"))
    .option("--per-page <number>", t("comment.perPageOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: CommentsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      const postNumber =
        options.post !== undefined
          ? positiveInt(options.post, "--post")
          : undefined;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      // openapi-fetch は GET のパスにリテラル文字列を要求するので、記事絞り込みと
      // チーム全体で分岐する。
      if (postNumber !== undefined) {
        const result = await client.GET(
          "/v1/teams/{team_name}/posts/{post_number}/comments",
          {
            params: {
              path: { team_name: team, post_number: postNumber },
              query,
            },
          },
        );
        print(unwrap(result));
        return;
      }
      const result = await client.GET("/v1/teams/{team_name}/comments", {
        params: { path: { team_name: team }, query },
      });
      print(unwrap(result));
    });

  comment
    .command("get")
    .argument("<id>", t("comment.idArg"))
    .description(t("comment.getDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--stargazers", t("comment.stargazersOpt"))
    .action(
      async (id: string, options: { team?: string; stargazers?: boolean }) => {
        const commentId = positiveInt(id, t("comment.idLabel"));

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        const result = await client.GET(
          "/v1/teams/{team_name}/comments/{comment_id}",
          {
            params: {
              path: { team_name: team, comment_id: commentId },
              query: options.stargazers ? { include: "stargazers" } : {},
            },
          },
        );
        print(unwrap(result));
      },
    );

  type CreateOptions = BodyOptions & { team?: string; user?: string };

  comment
    .command("create")
    .argument("<post_number>", t("comment.createPostArg"))
    .description(t("comment.createDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--body <markdown>", t("comment.bodyOpt"))
    .option("--body-file <path>", t("comment.bodyFileOpt"))
    .option("--user <screen_name>", t("comment.userOpt"))
    .action(async (postNumberArg: string, options: CreateOptions) => {
      // 記事番号・本文の検証をネットワークより先に行う。
      const postNumber = positiveInt(postNumberArg, t("post.idLabel"));
      const bodyMd = requireBody(options);

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.POST(
        "/v1/teams/{team_name}/posts/{post_number}/comments",
        {
          params: { path: { team_name: team, post_number: postNumber } },
          body: { comment: { body_md: bodyMd, user: options.user } },
        },
      );
      print(unwrap(result));
    });

  type UpdateOptions = BodyOptions & { team?: string; user?: string };

  comment
    .command("update")
    .argument("<id>", t("comment.idArg"))
    .description(t("comment.updateDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--body <markdown>", t("comment.bodyOpt"))
    .option("--body-file <path>", t("comment.bodyFileOpt"))
    .option("--user <screen_name>", t("comment.userOpt"))
    .action(async (id: string, options: UpdateOptions) => {
      const commentId = positiveInt(id, t("comment.idLabel"));
      const bodyMd = requireBody(options);

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.PATCH(
        "/v1/teams/{team_name}/comments/{comment_id}",
        {
          params: { path: { team_name: team, comment_id: commentId } },
          body: { comment: { body_md: bodyMd, user: options.user } },
        },
      );
      print(unwrap(result));
    });

  comment
    .command("delete")
    .argument("<id>", t("comment.idArg"))
    .description(t("comment.deleteDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("-y, --yes", t("comment.yesOpt"))
    .action(async (id: string, options: { team?: string; yes?: boolean }) => {
      const commentId = positiveInt(id, t("comment.idLabel"));

      // 非対話環境（パイプ・CI）ではプロンプトを出せないので、ネットワークより
      // 先に --yes を必須にする。
      if (!options.yes && !process.stdin.isTTY) {
        throw new Error(t("comment.deleteConfirmRequired"));
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);

      if (!options.yes) {
        // 削除対象を取り違えないよう、本文の先頭を見せてから確認する。
        const got = await client.GET(
          "/v1/teams/{team_name}/comments/{comment_id}",
          { params: { path: { team_name: team, comment_id: commentId } } },
        );
        const body = unwrap(got).body_md ?? "";
        const ok = await confirm(
          t("comment.deleteConfirm", {
            id: commentId,
            preview: preview(body),
          }),
        );
        if (!ok) {
          console.error(t("comment.deleteCanceled"));
          return;
        }
      }

      const result = await client.DELETE(
        "/v1/teams/{team_name}/comments/{comment_id}",
        { params: { path: { team_name: team, comment_id: commentId } } },
      );
      unwrap(result); // 204 No Content。エラー時はここで投げる。
      console.error(t("comment.deleteDone", { id: commentId }));
    });
}
