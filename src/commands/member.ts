import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt } from "./parse.js";

type MembersQuery = NonNullable<
  paths["/v1/teams/{team_name}/members"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  sort?: string;
  order?: string;
};

export function registerMemberCommand(program: Command): void {
  const member = program.command("member").description(t("member.desc"));

  member
    .command("list")
    .description(t("member.listDesc"))
    .option("--team <name>", t("member.teamOpt"))
    .option("--page <number>", t("member.pageOpt"))
    .option("--per-page <number>", t("member.perPageOpt"))
    .option("--sort <sort>", t("member.sortOpt"))
    .option("--order <order>", t("member.orderOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: MembersQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (
        options.sort === "posts_count" ||
        options.sort === "joined" ||
        options.sort === "last_accessed"
      ) {
        query.sort = options.sort;
      }
      if (options.order === "desc" || options.order === "asc") {
        query.order = options.order;
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/members", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
