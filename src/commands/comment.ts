import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { cyan, dim } from "../output/color.js";
import { printDetail } from "../output/detail.js";
import { type Column, printList } from "../output/list.js";
import { printMutation, printSuccess } from "../output/mutation.js";
import { displayTime } from "../output/time.js";
import { type BodyOptions, requireBody } from "./body-input.js";
import { confirm } from "./confirm.js";
import { positiveInt } from "./parse.js";

type CommentsQuery = NonNullable<
  paths["/v1/teams/{team_name}/comments"]["get"]["parameters"]["query"]
>;

type Comment = components["schemas"]["Comment"];

/** 削除確認用に本文の先頭行を短く整える。 */
function preview(body: string): string {
  const firstLine = body.split("\n")[0] ?? "";
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

const COMMENT_COLUMNS: Column<Comment>[] = [
  {
    header: t("output.colId"),
    value: (comment) => String(comment.id),
    color: cyan,
    truncate: false,
  },
  {
    header: t("output.colPost"),
    value: (comment) => String(comment.post_number),
    truncate: false,
  },
  {
    header: t("output.colBody"),
    // 本文は複数行になりうるので、桁揃えを壊さないよう先頭行だけを出す。
    value: (comment) => comment.body_md.split("\n")[0] ?? "",
  },
  {
    header: t("output.colAuthor"),
    value: (comment) => comment.created_by?.screen_name ?? "",
  },
  {
    header: t("output.colCreated"),
    value: (comment) => displayTime(comment.created_at),
    color: dim,
  },
];

export function registerCommentCommand(program: Command): void {
  const comment = program.command("comment").description(t("comment.desc"));

  type ListOptions = {
    team?: string;
    post?: string;
    page?: string;
    perPage?: string;
    json?: string | true;
  };

  comment
    .command("list")
    .description(t("comment.listDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--post <number>", t("comment.listPostOpt"))
    .option("--page <number>", t("comment.pageOpt"))
    .option("--per-page <number>", t("comment.perPageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      // チーム全体で分岐する。応答の形は同じなので、出力はまとめて行う。
      const payload =
        postNumber !== undefined
          ? unwrap(
              await client.GET(
                "/v1/teams/{team_name}/posts/{post_number}/comments",
                {
                  params: {
                    path: { team_name: team, post_number: postNumber },
                    query,
                  },
                },
              ),
            )
          : unwrap(
              await client.GET("/v1/teams/{team_name}/comments", {
                params: { path: { team_name: team }, query },
              }),
            );
      printList({
        items: payload.comments ?? [],
        columns: COMMENT_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (comments) => ({ ...payload, comments }),
      });
    });

  comment
    .command("view")
    // esa API の GET に合わせて get でも引ける。
    .alias("get")
    .argument("<id>", t("comment.idArg"))
    .description(t("comment.viewDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--stargazers", t("comment.stargazersOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(
      async (
        id: string,
        options: {
          team?: string;
          stargazers?: boolean;
          json?: string | true;
        },
      ) => {
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
        const comment = unwrap(result);
        printDetail({
          item: comment,
          title: `#${comment.id}`,
          fields: [
            {
              key: "post_number",
              label: t("output.fieldPost"),
              value: String(comment.post_number),
            },
            {
              key: "created_by",
              label: t("output.fieldCreatedBy"),
              value: comment.created_by?.screen_name ?? "",
            },
            {
              key: "created_at",
              label: t("output.fieldCreated"),
              value: displayTime(comment.created_at),
            },
            {
              key: "stargazers_count",
              label: t("output.fieldStars"),
              value: String(comment.stargazers_count ?? 0),
            },
            { key: "url", label: t("output.fieldUrl"), value: comment.url },
          ],
          body: comment.body_md,
          json: options.json,
        });
      },
    );

  type CreateOptions = BodyOptions & {
    team?: string;
    user?: string;
    json?: string | true;
  };

  comment
    .command("create")
    .argument("<post_number>", t("comment.createPostArg"))
    .description(t("comment.createDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--body <markdown>", t("comment.bodyOpt"))
    .option("--body-file <path>", t("comment.bodyFileOpt"))
    .option("--user <screen_name>", t("comment.userOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const created = unwrap(result);
      printMutation({
        item: created,
        url: created.url,
        message: t("comment.createDone", {
          id: created.id,
          number: created.post_number,
        }),
        json: options.json,
      });
    });

  type UpdateOptions = BodyOptions & {
    team?: string;
    user?: string;
    json?: string | true;
  };

  comment
    .command("update")
    .argument("<id>", t("comment.idArg"))
    .description(t("comment.updateDesc"))
    .option("--team <name>", t("comment.teamOpt"))
    .option("--body <markdown>", t("comment.bodyOpt"))
    .option("--body-file <path>", t("comment.bodyFileOpt"))
    .option("--user <screen_name>", t("comment.userOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const updated = unwrap(result);
      printMutation({
        item: updated,
        url: updated.url,
        message: t("comment.updateDone", { id: updated.id }),
        json: options.json,
      });
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
      printSuccess(t("comment.deleteDone", { id: commentId }));
    });
}
