import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { positiveInt } from "./parse.js";

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
      if (options.role === "member" || options.role === "owner") {
        query.role = options.role;
      }

      const client = createEsaClient();
      const result = await client.GET("/v1/teams", { params: { query } });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
