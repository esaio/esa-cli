import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold, yellow } from "../output/color.js";
import { printDetail } from "../output/detail.js";
import { type Column, printList } from "../output/list.js";
import { positiveInt, serverEnum } from "./parse.js";

type TeamsQuery = NonNullable<paths["/v1/teams"]["get"]["parameters"]["query"]>;

type Team = components["schemas"]["Team"];

type ListOptions = {
  page?: string;
  perPage?: string;
  role?: string;
  json?: string | true;
};

const TEAM_COLUMNS: Column<Team>[] = [
  { header: t("output.colName"), value: (team) => team.name, color: bold },
  { header: t("output.colDescription"), value: (team) => team.description },
  {
    header: t("output.colPrivacy"),
    value: (team) => team.privacy,
    // 非公開かどうかは見落とすと困るので、closed だけ色を変える。
    color: (value, team) => (team.privacy === "closed" ? yellow(value) : value),
    truncate: false,
  },
];

export function registerTeamCommand(program: Command): void {
  const team = program.command("team").description(t("team.desc"));

  team
    .command("list")
    .description(t("team.listDesc"))
    .option("--page <number>", t("team.pageOpt"))
    .option("--per-page <number>", t("team.perPageOpt"))
    .option("--role <role>", t("team.roleOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
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
      const payload = unwrap(result);
      printList({
        items: payload.teams ?? [],
        columns: TEAM_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (teams) => ({ ...payload, teams }),
        pagination: payload,
      });
    });

  team
    .command("stats")
    .description(t("team.statsDesc"))
    .option("--team <name>", t("team.teamOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: { team?: string; json?: string | true }) => {
      const client = createEsaClient();
      const teamName = await resolveTeam(client, options.team);
      const result = await client.GET("/v1/teams/{team_name}/stats", {
        params: { path: { team_name: teamName } },
      });
      const stats = unwrap(result);
      printDetail({
        item: stats,
        title: teamName,
        fields: [
          {
            key: "members",
            label: t("output.fieldMembers"),
            value: String(stats.members),
          },
          // 合成せずフィールドごとに出す。パイプ先が内訳をそのまま扱えるように。
          {
            key: "posts",
            label: t("output.fieldPosts"),
            value: String(stats.posts),
          },
          {
            key: "posts_wip",
            label: t("output.fieldPostsWip"),
            value: String(stats.posts_wip),
          },
          {
            key: "posts_shipped",
            label: t("output.fieldPostsShipped"),
            value: String(stats.posts_shipped),
          },
          {
            key: "comments",
            label: t("output.fieldComments"),
            value: String(stats.comments),
          },
          {
            key: "stars",
            label: t("output.fieldStars"),
            value: String(stats.stars),
          },
          {
            key: "daily_active_users",
            label: t("output.fieldDailyActiveUsers"),
            value: String(stats.daily_active_users),
          },
          {
            key: "weekly_active_users",
            label: t("output.fieldWeeklyActiveUsers"),
            value: String(stats.weekly_active_users),
          },
          {
            key: "monthly_active_users",
            label: t("output.fieldMonthlyActiveUsers"),
            value: String(stats.monthly_active_users),
          },
        ],
        json: options.json,
      });
    });
}
