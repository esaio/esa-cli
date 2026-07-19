import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
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
  const post = program.command("post").description(t("post.desc"));

  post
    .command("list")
    .description(t("post.listDesc"))
    .option("--team <name>", t("post.listTeamOpt"))
    .option("--page <number>", t("post.pageOpt"))
    .option("--per-page <number>", t("post.perPageOpt"))
    .option("-q, --query <query>", t("post.queryOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: PostsQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      if (options.query) query.q = options.query;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/posts", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  post
    .command("get")
    .argument("<number>", t("post.numberArg"))
    .description(t("post.getDesc"))
    .option("--team <name>", t("post.getTeamOpt"))
    .action(async (number: string, options: { team?: string }) => {
      // 記事番号の検証をネットワークより先に行う。
      const postNumber = positiveInt(number, t("post.idLabel"));

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET(
        "/v1/teams/{team_name}/posts/{post_number}",
        { params: { path: { team_name: team, post_number: postNumber } } },
      );
      console.log(JSON.stringify(unwrap(result), null, 2));
    });
}
