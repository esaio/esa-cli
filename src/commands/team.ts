import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";

type TeamsQuery = NonNullable<paths["/v1/teams"]["get"]["parameters"]["query"]>;

type ListOptions = {
  page?: string;
  perPage?: string;
  role?: string;
};

export function registerTeamCommand(program: Command): void {
  const team = program.command("team").description("Work with teams");

  team
    .command("list")
    .description("List teams you belong to (GET /v1/teams)")
    .option("--page <number>", "ページ番号")
    .option("--per-page <number>", "1ページあたりの件数")
    .option("--role <role>", "権限で絞り込み (member | owner)")
    .action(async (options: ListOptions) => {
      const query: TeamsQuery = {};
      if (options.page) query.page = Number(options.page);
      if (options.perPage) query.per_page = Number(options.perPage);
      if (options.role === "member" || options.role === "owner") {
        query.role = options.role;
      }

      const client = createEsaClient();
      const result = await client.GET("/v1/teams", { params: { query } });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
