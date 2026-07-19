import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";
import { t } from "../i18n/index.js";

export function registerUserCommand(program: Command): void {
  program
    .command("user")
    .description(t("user.desc"))
    .action(async () => {
      const client = createEsaClient();
      const result = await client.GET("/v1/user");
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
