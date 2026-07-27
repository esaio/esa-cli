import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold } from "../output/color.js";
import { type Column, printList } from "../output/list.js";
import { positiveInt } from "./parse.js";

type TagsQuery = NonNullable<
  paths["/v1/teams/{team_name}/tags"]["get"]["parameters"]["query"]
>;

type Tag = components["schemas"]["Tag"];

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  json?: string | true;
};

const TAG_COLUMNS: Column<Tag>[] = [
  { header: t("output.colTag"), value: (tag) => tag.name, color: bold },
  {
    header: t("output.colPosts"),
    value: (tag) => String(tag.posts_count),
    truncate: false,
  },
];

export function registerTagCommand(program: Command): void {
  const tag = program.command("tag").description(t("tag.desc"));

  tag
    .command("list")
    .description(t("tag.listDesc"))
    .option("--team <name>", t("tag.teamOpt"))
    .option("--page <number>", t("tag.pageOpt"))
    .option("--per-page <number>", t("tag.perPageOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const payload = unwrap(result);
      printList({
        items: payload.tags ?? [],
        columns: TAG_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (tags) => ({ ...payload, tags }),
      });
    });
}
