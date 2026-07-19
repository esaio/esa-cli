import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt } from "./parse.js";

type TagsQuery = NonNullable<
  paths["/v1/teams/{team_name}/tags"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
};

export function registerTagCommand(program: Command): void {
  const tag = program.command("tag").description(t("tag.desc"));

  tag
    .command("list")
    .description(t("tag.listDesc"))
    .option("--team <name>", t("tag.teamOpt"))
    .option("--page <number>", t("tag.pageOpt"))
    .option("--per-page <number>", t("tag.perPageOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: TagsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/tags", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
