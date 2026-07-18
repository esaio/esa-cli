import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { positiveInt } from "./parse.js";

type PostsQuery = NonNullable<
  paths["/v1/teams/{team_name}/posts"]["get"]["parameters"]["query"]
>;

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  query?: string;
};

export function registerPostCommand(program: Command): void {
  const post = program.command("post").description("Work with posts");

  post
    .command("list")
    .description("List posts in a team (GET /v1/teams/{team_name}/posts)")
    .option(
      "--team <name>",
      "対象チーム（省略時は ESA_TEAM / 既定チーム / 単一所属を使用）",
    )
    .option("--page <number>", "ページ番号")
    .option("--per-page <number>", "1ページあたりの件数")
    .option("-q, --query <query>", "検索クエリ")
    .action(async (options: ListOptions) => {
      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);

      const query: PostsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (options.query) query.q = options.query;

      const result = await client.GET("/v1/teams/{team_name}/posts", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  post
    .command("get")
    .argument("<number>", "記事番号")
    .description("Get a post (GET /v1/teams/{team_name}/posts/{post_number})")
    .option("--team <name>", "対象チーム")
    .action(async (number: string, options: { team?: string }) => {
      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const postNumber = positiveInt(number, "number");

      const result = await client.GET(
        "/v1/teams/{team_name}/posts/{post_number}",
        { params: { path: { team_name: team, post_number: postNumber } } },
      );
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
