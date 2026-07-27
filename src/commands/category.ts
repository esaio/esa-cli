import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold } from "../output/color.js";
import { type Column, printList } from "../output/list.js";
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

type CategoryPath = components["schemas"]["CategoryPath"];

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  prefix?: string;
  suffix?: string;
  match?: string;
  exactMatch?: string;
  all?: boolean;
  json?: string | true;
};

const CATEGORY_COLUMNS: Column<CategoryPath>[] = [
  // path は未分類を表す null がありうる。
  {
    header: t("output.colPath"),
    value: (category) => category.path ?? "",
    color: bold,
  },
  {
    header: t("output.colPosts"),
    value: (category) => String(category.posts),
    truncate: false,
  },
];

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
    .option("--json [fields]", t("output.jsonOpt"))
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
        printList({
          items: categories,
          columns: CATEGORY_COLUMNS,
          emptyMessage: t("output.noResults"),
          json: options.json,
          wrapJson: (projected) => ({
            categories: projected,
            total_count: totalCount,
          }),
        });
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
      const payload = unwrap(result) as PagedCategoryPaths;
      printList({
        items: payload.categories ?? [],
        columns: CATEGORY_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (categories) => ({ ...payload, categories }),
      });
    });
}
