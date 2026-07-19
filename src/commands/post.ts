import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { type BodyOptions, readBody, requireBody } from "./body-input.js";
import { confirm } from "./confirm.js";
import { positiveInt } from "./parse.js";

type PostsQuery = NonNullable<
  paths["/v1/teams/{team_name}/posts"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  query?: string;
};

type WipOptions = { wip?: boolean; ship?: boolean };

/**
 * --wip / --ship から WIP 状態を決める。両方指定はエラー。どちらも無ければ
 * undefined（作成時は既定 true、更新時は現状維持）。
 */
function resolveWip(options: WipOptions): boolean | undefined {
  if (options.wip && options.ship) {
    throw new Error(t("post.wipConflict"));
  }
  if (options.wip) return true;
  if (options.ship) return false;
  return undefined;
}

/** カンマ区切りのタグを配列にする。空文字は除く。未指定なら undefined。 */
function parseTags(tags?: string): string[] | undefined {
  if (tags === undefined) return undefined;
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * 記事名に "/" が含まれ、かつ --category 未指定なら、末尾をタイトル・残りを
 * カテゴリとして分割する（esa の慣習。mcp-server の normalizePostName と同じ）。
 */
function splitNameCategory(
  name: string | undefined,
  category: string | undefined,
): { name?: string; category?: string } {
  if (!name || category !== undefined || !name.includes("/")) {
    return { name, category };
  }
  const parts = name.split("/");
  const extractedName = parts.pop();
  return { name: extractedName || undefined, category: parts.join("/") };
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function registerPostCommand(program: Command): void {
  const post = program.command("post").description(t("post.desc"));

  post
    .command("list")
    .description(t("post.listDesc"))
    .option("--team <name>", t("post.listTeamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .option("-q, --query <query>", t("post.queryOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: PostsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (options.query) query.q = options.query;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/posts", {
        params: { path: { team_name: team }, query },
      });
      print(unwrap(result));
    });

  post
    .command("search")
    .argument("<query>", t("post.searchQueryArg"))
    .description(t("post.searchDesc"))
    .option("--team <name>", t("post.listTeamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .action(async (queryArg: string, options: ListOptions) => {
      const query: PostsQuery = { q: queryArg };
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/posts", {
        params: { path: { team_name: team }, query },
      });
      print(unwrap(result));
    });

  post
    .command("get")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.getDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .action(async (number: string, options: { team?: string }) => {
      // 記事番号の検証をネットワークより先に行う。
      const postNumber = positiveInt(number, t("post.idLabel"));

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET(
        "/v1/teams/{team_name}/posts/{post_number}",
        { params: { path: { team_name: team, post_number: postNumber } } },
      );
      print(unwrap(result));
    });

  type CreateOptions = BodyOptions &
    WipOptions & {
      team?: string;
      category?: string;
      tags?: string;
      message?: string;
    };

  post
    .command("create")
    .argument("<name>", t("post.createNameArg"))
    .description(t("post.createDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--category <path>", t("post.categoryOpt"))
    .option("--tags <tags>", t("post.tagsOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .action(async (nameArg: string, options: CreateOptions) => {
      // 本文・WIP・記事名の検証をネットワークより先に行う。
      const bodyMd = readBody(options);
      const wip = resolveWip(options);
      const { name, category } = splitNameCategory(nameArg, options.category);
      // "foo/" のように分割後の名前が空になる入力は不正として弾く。
      if (!name) throw new Error(t("post.emptyName"));

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.POST("/v1/teams/{team_name}/posts", {
        params: { path: { team_name: team } },
        body: {
          post: {
            name,
            body_md: bodyMd,
            category,
            tags: parseTags(options.tags),
            wip: wip ?? true,
            message: options.message,
          },
        },
      });
      print(unwrap(result));
    });

  type UpdateOptions = BodyOptions &
    WipOptions & {
      team?: string;
      name?: string;
      category?: string;
      tags?: string;
      message?: string;
    };

  post
    .command("update")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.updateDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("--name <name>", t("post.nameOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--category <path>", t("post.categoryOpt"))
    .option("--tags <tags>", t("post.tagsOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .action(async (number: string, options: UpdateOptions) => {
      const postNumber = positiveInt(number, t("post.idLabel"));
      const bodyMd = readBody(options);
      const wip = resolveWip(options);
      const { name, category } = splitNameCategory(
        options.name,
        options.category,
      );
      // --name を指定したのに分割後が空（"foo/" など）なら弾く。未指定なら不変。
      if (options.name !== undefined && !name) {
        throw new Error(t("post.emptyName"));
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.PATCH(
        "/v1/teams/{team_name}/posts/{post_number}",
        {
          params: { path: { team_name: team, post_number: postNumber } },
          body: {
            post: {
              name,
              body_md: bodyMd,
              category,
              tags: parseTags(options.tags),
              wip,
              message: options.message,
            },
          },
        },
      );
      print(unwrap(result));
    });

  type InsertOptions = BodyOptions &
    WipOptions & { team?: string; message?: string };

  post
    .command("append")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.appendDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .action(async (number: string, options: InsertOptions) => {
      const postNumber = positiveInt(number, t("post.idLabel"));
      const content = requireBody(options);
      const wip = resolveWip(options);

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.POST(
        "/v1/teams/{team_name}/posts/{post_number}/append",
        {
          params: { path: { team_name: team, post_number: postNumber } },
          body: { post: { content, wip, message: options.message } },
        },
      );
      print(unwrap(result));
    });

  post
    .command("prepend")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.prependDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .action(async (number: string, options: InsertOptions) => {
      const postNumber = positiveInt(number, t("post.idLabel"));
      const content = requireBody(options);
      const wip = resolveWip(options);

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.POST(
        "/v1/teams/{team_name}/posts/{post_number}/prepend",
        {
          params: { path: { team_name: team, post_number: postNumber } },
          body: { post: { content, wip, message: options.message } },
        },
      );
      print(unwrap(result));
    });

  post
    .command("archive")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.archiveDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .action(
      async (number: string, options: { team?: string; message?: string }) => {
        const postNumber = positiveInt(number, t("post.idLabel"));

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        const got = await client.GET(
          "/v1/teams/{team_name}/posts/{post_number}",
          { params: { path: { team_name: team, post_number: postNumber } } },
        );
        const current = unwrap(got).category ?? "";
        if (current === "Archived" || current.startsWith("Archived/")) {
          console.error(
            t("post.alreadyArchived", {
              number: postNumber,
              category: current,
            }),
          );
          return;
        }

        const archived = current === "" ? "Archived" : `Archived/${current}`;
        const result = await client.PATCH(
          "/v1/teams/{team_name}/posts/{post_number}",
          {
            params: { path: { team_name: team, post_number: postNumber } },
            body: {
              post: {
                category: archived,
                message: options.message ?? "Archive post",
              },
            },
          },
        );
        print(unwrap(result));
      },
    );

  post
    .command("delete")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.deleteDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .option("-y, --yes", t("post.yesOpt"))
    .action(
      async (number: string, options: { team?: string; yes?: boolean }) => {
        const postNumber = positiveInt(number, t("post.idLabel"));

        // 非対話環境（パイプ・CI）ではプロンプトを出せないので、ネットワーク
        // より先に --yes を必須にする。
        if (!options.yes && !process.stdin.isTTY) {
          throw new Error(t("post.deleteConfirmRequired"));
        }

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);

        if (!options.yes) {
          // 削除対象を取り違えないよう、記事名を見せてから確認する。
          const got = await client.GET(
            "/v1/teams/{team_name}/posts/{post_number}",
            { params: { path: { team_name: team, post_number: postNumber } } },
          );
          const name = unwrap(got).name ?? "";
          const ok = await confirm(
            t("post.deleteConfirm", { number: postNumber, name }),
          );
          if (!ok) {
            console.error(t("post.deleteCanceled"));
            return;
          }
        }

        const result = await client.DELETE(
          "/v1/teams/{team_name}/posts/{post_number}",
          { params: { path: { team_name: team, post_number: postNumber } } },
        );
        unwrap(result); // 204 No Content。エラー時はここで投げる。
        console.error(t("post.deleteDone", { number: postNumber }));
      },
    );
}
