import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold, cyan, dim, green, yellow } from "../output/color.js";
import { type DetailField, printDetail } from "../output/detail.js";
import { type Column, printList } from "../output/list.js";
import { printMutation, printSuccess } from "../output/mutation.js";
import { displayTime } from "../output/time.js";
import { type BodyOptions, readBody, requireBody } from "./body-input.js";
import { confirm } from "./confirm.js";
import { positiveInt } from "./parse.js";

type PostsQuery = NonNullable<
  paths["/v1/teams/{team_name}/posts"]["get"]["parameters"]["query"]
>;

type BacklinksQuery = NonNullable<
  paths["/v1/teams/{team_name}/posts/{post_number}/backlinks"]["get"]["parameters"]["query"]
>;

type RevisionsQuery = NonNullable<
  paths["/v1/teams/{team_name}/posts/{post_number}/revisions"]["get"]["parameters"]["query"]
>;

type Post = components["schemas"]["Post"];
type PostSummary = components["schemas"]["PostSummary"];
type Revision = components["schemas"]["Revision"];

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  query?: string;
  json?: string | true;
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
 * カテゴリとして分割する（esa の慣習）。
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

function numberColumn<T>(value: (item: T) => number): Column<T> {
  return {
    header: t("output.colNumber"),
    value: (item) => String(value(item)),
    color: cyan,
    truncate: false,
  };
}

/** WIP / Ship の状態列。 */
function stateColumn<T>(wip: (item: T) => boolean): Column<T> {
  return {
    header: t("output.colState"),
    value: (item) => (wip(item) ? t("output.stateWip") : t("output.stateShip")),
    color: (value, item) => (wip(item) ? yellow(value) : green(value)),
    truncate: false,
  };
}

const POST_COLUMNS: Column<Post>[] = [
  numberColumn((post) => post.number),
  {
    header: t("output.colTitle"),
    value: (post) => post.full_name,
    color: bold,
  },
  stateColumn((post) => post.wip),
  {
    header: t("output.colUpdatedBy"),
    value: (post) => post.updated_by?.screen_name ?? "",
  },
  {
    header: t("output.colUpdated"),
    value: (post) => displayTime(post.updated_at),
    color: dim,
  },
];

const SUMMARY_COLUMNS: Column<PostSummary>[] = [
  numberColumn((post) => post.number),
  {
    header: t("output.colTitle"),
    value: (post) => post.full_name,
    color: bold,
  },
  stateColumn((post) => post.wip),
  {
    header: t("output.colUpdated"),
    value: (post) => displayTime(post.updated_at),
    color: dim,
  },
];

const REVISION_COLUMNS: Column<Revision>[] = [
  {
    header: t("output.colRevision"),
    value: (revision) => String(revision.number),
    color: cyan,
    truncate: false,
  },
  {
    header: t("output.colAuthor"),
    value: (revision) => revision.created_by?.screen_name ?? "",
  },
  {
    header: t("output.colMessage"),
    value: (revision) => revision.message ?? "",
  },
  {
    header: t("output.colCreated"),
    value: (revision) => displayTime(revision.created_at),
    color: dim,
  },
];

/** 本文の前に出すメタ情報。key は API のフィールド名に揃える。 */
function postDetailFields(post: Post): DetailField[] {
  return [
    {
      key: "wip",
      label: t("output.fieldState"),
      value: post.wip ? t("output.stateWip") : t("output.stateShip"),
    },
    {
      key: "category",
      label: t("output.fieldCategory"),
      value: post.category ?? "",
    },
    {
      key: "tags",
      label: t("output.fieldTags"),
      value: post.tags.join(", "),
    },
    {
      key: "updated_by",
      label: t("output.fieldUpdatedBy"),
      value: post.updated_by?.screen_name ?? "",
    },
    {
      key: "updated_at",
      label: t("output.fieldUpdated"),
      value: displayTime(post.updated_at),
    },
    {
      key: "revision_number",
      label: t("output.fieldRevision"),
      value: String(post.revision_number),
    },
    {
      key: "comments_count",
      label: t("output.fieldComments"),
      value: String(post.comments_count ?? 0),
    },
    { key: "url", label: t("output.fieldUrl"), value: post.url },
  ];
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
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      // ただし --json のフィールド名だけは、候補を応答から取る都合で後になる。
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
      const payload = unwrap(result);
      printList({
        items: payload.posts ?? [],
        columns: POST_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        // ページ情報は残す。次ページの有無は絞り込みとは無関係に必要になる。
        wrapJson: (posts) => ({ ...payload, posts }),
        pagination: payload,
      });
    });

  post
    .command("search")
    .argument("<query>", t("post.searchQueryArg"))
    .description(t("post.searchDesc"))
    .option("--team <name>", t("post.listTeamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const payload = unwrap(result);
      printList({
        items: payload.posts ?? [],
        columns: POST_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (posts) => ({ ...payload, posts }),
        pagination: payload,
      });
    });

  post
    .command("view")
    // esa API の GET に合わせて get でも引ける。
    .alias("get")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.viewDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(
      async (
        number: string,
        options: { team?: string; json?: string | true },
      ) => {
        // 記事番号の検証をネットワークより先に行う。
        const postNumber = positiveInt(number, t("post.idLabel"));

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        const result = await client.GET(
          "/v1/teams/{team_name}/posts/{post_number}",
          { params: { path: { team_name: team, post_number: postNumber } } },
        );
        const post = unwrap(result);
        printDetail({
          item: post,
          // esa はタイトル内に #タグ を書けるので、番号は括弧で括って区別する。
          title: `${post.full_name} (#${post.number})`,
          fields: postDetailFields(post),
          body: post.body_md,
          json: options.json,
        });
      },
    );

  post
    .command("backlinks")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.backlinksDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (number: string, options: ListOptions) => {
      // 記事番号・ページ指定の検証をネットワークより先に行う。
      const postNumber = positiveInt(number, t("post.idLabel"));
      const query: BacklinksQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET(
        "/v1/teams/{team_name}/posts/{post_number}/backlinks",
        {
          params: {
            path: { team_name: team, post_number: postNumber },
            query,
          },
        },
      );
      const payload = unwrap(result);
      printList({
        items: payload.posts ?? [],
        columns: SUMMARY_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (posts) => ({ ...payload, posts }),
        pagination: payload,
      });
    });

  post
    .command("revisions")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.revisionsDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (number: string, options: ListOptions) => {
      // 記事番号・ページ指定の検証をネットワークより先に行う。
      const postNumber = positiveInt(number, t("post.idLabel"));
      const query: RevisionsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET(
        "/v1/teams/{team_name}/posts/{post_number}/revisions",
        {
          params: {
            path: { team_name: team, post_number: postNumber },
            query,
          },
        },
      );
      const payload = unwrap(result);
      printList({
        items: payload.revisions ?? [],
        columns: REVISION_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (revisions) => ({ ...payload, revisions }),
        pagination: payload,
      });
    });

  type CreateOptions = BodyOptions &
    WipOptions & {
      team?: string;
      category?: string;
      tags?: string;
      message?: string;
      json?: string | true;
    };

  post
    .command("create")
    .argument("<name>", t("post.createNameArg"))
    .description(t("post.createDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--category <path>", t("post.categoryOpt"))
    .option("--tags <tags>", t("post.tagsOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const created = unwrap(result);
      printMutation({
        item: created,
        url: created.url,
        message: t("post.createDone", {
          number: created.number,
          name: created.full_name,
        }),
        json: options.json,
      });
    });

  type UpdateOptions = BodyOptions &
    WipOptions & {
      team?: string;
      name?: string;
      category?: string;
      tags?: string;
      message?: string;
      json?: string | true;
    };

  post
    .command("update")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.updateDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--name <name>", t("post.nameOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--category <path>", t("post.categoryOpt"))
    .option("--tags <tags>", t("post.tagsOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const updated = unwrap(result);
      printMutation({
        item: updated,
        url: updated.url,
        message: t("post.updateDone", {
          number: updated.number,
          name: updated.full_name,
        }),
        json: options.json,
      });
    });

  type InsertOptions = BodyOptions &
    WipOptions & { team?: string; message?: string; json?: string | true };

  post
    .command("append")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.appendDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const appended = unwrap(result);
      printMutation({
        item: appended,
        url: appended.url,
        message: t("post.appendDone", {
          number: appended.number,
          name: appended.full_name,
        }),
        json: options.json,
      });
    });

  post
    .command("prepend")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.prependDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--body <markdown>", t("post.bodyOpt"))
    .option("--body-file <path>", t("post.bodyFileOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const prepended = unwrap(result);
      printMutation({
        item: prepended,
        url: prepended.url,
        message: t("post.prependDone", {
          number: prepended.number,
          name: prepended.full_name,
        }),
        json: options.json,
      });
    });

  post
    .command("archive")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.archiveDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(
      async (
        number: string,
        options: { team?: string; message?: string; json?: string | true },
      ) => {
        const postNumber = positiveInt(number, t("post.idLabel"));

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        // Archived/ の付け替えも、すでにアーカイブ済みのときに何も変えない
        // ことも API 側の責務。CLI はカテゴリを組み立てない。
        const result = await client.POST(
          "/v1/teams/{team_name}/posts/{post_number}/archive",
          {
            params: { path: { team_name: team, post_number: postNumber } },
            body: {
              // message は既定を付けず、--message 指定時のみ送る（未指定なら
              // esa 側の既定に委ねる。保存データを実行時の言語で変えない）。
              post: { message: options.message },
            },
          },
        );
        const archivedPost = unwrap(result);
        printMutation({
          item: archivedPost,
          url: archivedPost.url,
          message: t("post.archiveDone", {
            number: archivedPost.number,
            name: archivedPost.full_name,
          }),
          json: options.json,
        });
      },
    );

  post
    .command("duplicate")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.duplicateDesc"))
    .option("--team <name>", t("post.sourceTeamOpt"))
    .option("--target-team <name>", t("post.targetTeamOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(
      async (
        number: string,
        options: {
          team?: string;
          targetTeam?: string;
          json?: string | true;
        },
      ) => {
        const postNumber = positiveInt(number, t("post.idLabel"));

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        // 複製時のデフォルト値（タイトル・本文）を /posts/new?parent_post_id で
        // 取得してから新規作成する。
        const prefill = await client.GET("/v1/teams/{team_name}/posts/new", {
          params: {
            path: { team_name: team },
            query: { parent_post_id: postNumber },
          },
        });
        const newPost = unwrap(prefill).post;
        // 複製先は既定で複製元と同じチーム。--target-team で別チームにも複製できる。
        // 空文字・空白のみの指定は未指定と同じく複製元へフォールバックさせる。
        const targetTeam = options.targetTeam?.trim() || team;
        const result = await client.POST("/v1/teams/{team_name}/posts", {
          params: { path: { team_name: targetTeam } },
          // タイトルにカテゴリが含まれるので name だけで復元される。タグは
          // /posts/new が返さないため引き継がれない（esa の仕様）。WIP で作る。
          body: {
            post: { name: newPost.name, body_md: newPost.body_md, wip: true },
          },
        });
        const duplicated = unwrap(result);
        printMutation({
          item: duplicated,
          url: duplicated.url,
          message: t("post.duplicateDone", {
            number: duplicated.number,
            name: duplicated.full_name,
          }),
          json: options.json,
        });
      },
    );

  post
    .command("rollback")
    .argument("<number>", t("post.numberArg"))
    .argument("<revision>", t("post.revisionArg"))
    .description(t("post.rollbackDesc"))
    .option("--team <name>", t("post.teamOpt"))
    .option("--wip", t("post.wipOpt"))
    .option("--ship", t("post.shipOpt"))
    .option("-m, --message <message>", t("post.messageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(
      async (
        number: string,
        revision: string,
        options: WipOptions & {
          team?: string;
          message?: string;
          json?: string | true;
        },
      ) => {
        // 記事番号・リビジョン番号・WIP の検証をネットワークより先に行う。
        const postNumber = positiveInt(number, t("post.idLabel"));
        const revisionNumber = positiveInt(revision, t("post.revisionLabel"));
        const wip = resolveWip(options);

        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        const result = await client.POST(
          "/v1/teams/{team_name}/posts/{post_number}/revisions/{revision_number}/rollback",
          {
            params: {
              path: {
                team_name: team,
                post_number: postNumber,
                revision_number: revisionNumber,
              },
            },
            // wip / message は指定時のみ送る。未指定なら esa 側の既定に委ねる
            // （wip は指定リビジョンの状態を継承、message は既定文言）。
            body: { post: { wip, message: options.message } },
          },
        );
        const rolledBack = unwrap(result);
        printMutation({
          item: rolledBack,
          url: rolledBack.url,
          message: t("post.rollbackDone", {
            number: rolledBack.number,
            revision: revisionNumber,
          }),
          json: options.json,
        });
      },
    );

  post
    .command("delete")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.deleteDesc"))
    .option("--team <name>", t("post.teamOpt"))
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
        printSuccess(t("post.deleteDone", { number: postNumber }));
      },
    );
}
