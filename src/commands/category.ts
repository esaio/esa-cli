import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt } from "./parse.js";

type PathsQuery = NonNullable<
  paths["/v1/teams/{team_name}/categories/paths"]["get"]["parameters"]["query"]
>;

// v=2 を付けたときのレスポンス（ページネーション情報つき）。
type PagedCategoryPaths = components["schemas"]["Pagination"] & {
  categories: components["schemas"]["CategoryPath"][];
};

// --all で全ページを取得するときの1リクエストあたりの件数。esa の per_page 上限。
const ALL_PER_PAGE = 100;

type CategoriesQuery = NonNullable<
  paths["/v1/teams/{team_name}/categories"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  prefix?: string;
  suffix?: string;
  match?: string;
  exactMatch?: string;
  all?: boolean;
};

type GetOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  include?: string;
  descendantPosts?: boolean;
};

export function registerCategoryCommand(program: Command): void {
  const category = program.command("category").description(t("category.desc"));

  category
    .command("list")
    .description(t("category.listDesc"))
    .option("--team <name>", t("category.teamOpt"))
    .option("--page <number>", t("category.pageOpt"))
    .option("--per-page <number>", t("category.perPageOpt"))
    .option("--prefix <text>", t("category.prefixOpt"))
    .option("--suffix <text>", t("category.suffixOpt"))
    .option("--match <text>", t("category.matchOpt"))
    .option("--exact-match <path>", t("category.exactMatchOpt"))
    .option("--all", t("category.allOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const page = options.page
        ? positiveInt(options.page, "--page")
        : undefined;
      const perPage = options.perPage
        ? positiveInt(options.perPage, "--per-page")
        : undefined;
      // --all は全ページを取得するので、特定ページの指定とは両立しない。
      if (options.all && page !== undefined) {
        throw new Error(t("category.allPageConflict"));
      }

      // 絞り込みは --all でも通常取得でも共通で効かせる。
      const filters: PathsQuery = {};
      if (options.prefix) filters.prefix = options.prefix;
      if (options.suffix) filters.suffix = options.suffix;
      if (options.match) filters.match = options.match;
      if (options.exactMatch) filters.exact_match = options.exactMatch;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);

      if (options.all) {
        // v=2 でページを辿り、全カテゴリパスを集約して返す。
        const base: PathsQuery = {
          ...filters,
          v: 2,
          per_page: perPage ?? ALL_PER_PAGE,
        };
        const categories: components["schemas"]["CategoryPath"][] = [];
        let totalCount: number | undefined;
        let nextPage: number | undefined = 1;
        while (nextPage !== undefined) {
          const result = await client.GET(
            "/v1/teams/{team_name}/categories/paths",
            {
              params: {
                path: { team_name: team },
                query: { ...base, page: nextPage },
              },
            },
          );
          const data = unwrap(result) as PagedCategoryPaths;
          categories.push(...data.categories);
          totalCount = data.total_count;
          nextPage = data.next_page ?? undefined;
        }
        console.log(
          JSON.stringify({ categories, total_count: totalCount }, null, 2),
        );
        return;
      }

      // 通常取得。常に v=2 を付け、他の list コマンドと同じくページング形式で返す。
      const query: PathsQuery = { ...filters, v: 2 };
      if (page !== undefined) query.page = page;
      if (perPage !== undefined) query.per_page = perPage;
      const result = await client.GET(
        "/v1/teams/{team_name}/categories/paths",
        { params: { path: { team_name: team }, query } },
      );
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  category
    .command("get")
    .argument("<path>", t("category.pathArg"))
    .description(t("category.getDesc"))
    .option("--team <name>", t("category.teamOpt"))
    .option("--page <number>", t("category.pageOpt"))
    .option("--per-page <number>", t("category.perPageOpt"))
    .option("--include <include>", t("category.includeOpt"))
    .option("--descendant-posts", t("category.descendantPostsOpt"))
    .action(async (pathArg: string, options: GetOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: CategoriesQuery = { select: pathArg };
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (
        options.include === "posts" ||
        options.include === "parent_categories"
      ) {
        query.include = options.include;
      }
      // descendant_posts は include=posts のときだけ有効なので、それに合わせて送る。
      if (options.descendantPosts && query.include === "posts") {
        query.descendant_posts = true;
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/categories", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  category
    .command("top")
    .description(t("category.topDesc"))
    .option("--team <name>", t("category.teamOpt"))
    .action(async (options: { team?: string }) => {
      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/categories/top", {
        params: { path: { team_name: team } },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
