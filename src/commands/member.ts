import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold, dim } from "../output/color.js";
import { type Column, printList } from "../output/list.js";
import { displayTime } from "../output/time.js";
import { positiveInt, serverEnum } from "./parse.js";

type MembersQuery = NonNullable<
  paths["/v1/teams/{team_name}/members"]["get"]["parameters"]["query"]
>;

type Member = components["schemas"]["Member"];

type ListOptions = {
  team?: string;
  page?: string;
  perPage?: string;
  sort?: string;
  order?: string;
  json?: string | true;
};

const MEMBER_COLUMNS: Column<Member>[] = [
  {
    header: t("output.colScreenName"),
    value: (member) => member.screen_name,
    color: bold,
  },
  { header: t("output.colName"), value: (member) => member.name },
  { header: t("output.colRole"), value: (member) => member.role },
  {
    header: t("output.colPosts"),
    value: (member) => String(member.posts_count),
    truncate: false,
  },
  {
    header: t("output.colLastAccess"),
    value: (member) => displayTime(member.last_accessed_at),
    color: dim,
  },
];

export function registerMemberCommand(program: Command): void {
  const member = program.command("member").description(t("member.desc"));

  member
    .command("list")
    .description(t("member.listDesc"))
    .option("--team <name>", t("member.teamOpt"))
    .option("--page <number>", t("member.pageOpt"))
    .option("--per-page <number>", t("member.perPageOpt"))
    .option("--sort <sort>", t("member.sortOpt"))
    .option("--order <order>", t("member.orderOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const query: MembersQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      const sort = serverEnum<NonNullable<MembersQuery["sort"]>>(options.sort);
      const order = serverEnum<NonNullable<MembersQuery["order"]>>(
        options.order,
      );
      if (sort !== undefined) query.sort = sort;
      if (order !== undefined) query.order = order;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/members", {
        params: { path: { team_name: team }, query },
      });
      const payload = unwrap(result);
      printList({
        items: payload.members ?? [],
        columns: MEMBER_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (members) => ({ ...payload, members }),
      });
    });
}
