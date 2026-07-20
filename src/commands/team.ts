import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt, serverEnum } from "./parse.js";

type TeamsQuery = NonNullable<paths["/v1/teams"]["get"]["parameters"]["query"]>;

type ListOptions = {
  page?: string;
  perPage?: string;
  role?: string;
};

export function registerTeamCommand(program: Command): void {
  const team = program.command("team").description(t("team.desc"));

  team
    .command("list")
    .description(t("team.listDesc"))
    .option("--page <number>", t("team.pageOpt"))
    .option("--per-page <number>", t("team.perPageOpt"))
    .option("--role <role>", t("team.roleOpt"))
    .action(async (options: ListOptions) => {
      const query: TeamsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      const role = serverEnum<NonNullable<TeamsQuery["role"]>>(options.role);
      if (role !== undefined) query.role = role;

      const client = createEsaClient();
      const result = await client.GET("/v1/teams", { params: { query } });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  team
    .command("stats")
    .description(t("team.statsDesc"))
    .option("--team <name>", t("team.teamOpt"))
    .action(async (options: { team?: string }) => {
      const client = createEsaClient();
      const teamName = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/stats", {
        params: { path: { team_name: teamName } },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
