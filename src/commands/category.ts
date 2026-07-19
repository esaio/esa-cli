import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt } from "./parse.js";

type PathsQuery = NonNullable<
  paths["/v1/teams/{team_name}/categories/paths"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  prefix?: string;
  suffix?: string;
  match?: string;
  exactMatch?: string;
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
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: PathsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (options.prefix) query.prefix = options.prefix;
      if (options.suffix) query.suffix = options.suffix;
      if (options.match) query.match = options.match;
      if (options.exactMatch) query.exact_match = options.exactMatch;
      // paths は既定で全件返る。ページング指定時のみ v=2 でページネーションを有効化。
      if (query.page !== undefined || query.per_page !== undefined) {
        query.v = 2;
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET(
        "/v1/teams/{team_name}/categories/paths",
        { params: { path: { team_name: team }, query } },
      );
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
