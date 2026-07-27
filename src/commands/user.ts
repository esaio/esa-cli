import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";
import { t } from "../i18n/index.js";
import { printDetail } from "../output/detail.js";

export function registerUserCommand(program: Command): void {
  program
    .command("user")
    .description(t("user.desc"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: { json?: string | true }) => {
      const client = createEsaClient();
      const result = await client.GET("/v1/user");
      const user = unwrap(result);
      printDetail({
        item: user,
        title: user.name,
        fields: [
          {
            key: "screen_name",
            label: t("output.fieldScreenName"),
            value: user.screen_name,
          },
          { key: "email", label: t("output.fieldEmail"), value: user.email },
          // teams は include 指定時のみ返る。
          ...(user.teams
            ? [
                {
                  key: "teams",
                  label: t("output.fieldTeams"),
                  value: user.teams.map((team) => team.name).join(", "),
                },
              ]
            : []),
        ],
        json: options.json,
      });
    });
}
