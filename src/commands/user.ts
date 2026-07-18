import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { unwrap } from "../api/response.js";

export function registerUserCommand(program: Command): void {
  program
    .command("user")
    .description("Show the authenticated user (GET /v1/user)")
    .action(async () => {
      const client = createEsaClient();
      const result = await client.GET("/v1/user");
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
