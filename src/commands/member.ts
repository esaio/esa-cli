import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { components, paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { bold, dim } from "../output/color.js";
import { printDetail } from "../output/detail.js";
import { type Column, printList } from "../output/list.js";
import { displayTime } from "../output/time.js";
import { nonEmpty, positiveInt, serverEnum } from "./parse.js";

type MembersQuery = NonNullable<
  paths["/v1/teams/{team_name}/members"]["get"]["parameters"]["query"]
>;

type Member = components["schemas"]["Member"];

type ListOptions = {
  team?: string;
  childTeam?: string;
  page?: string;
  perPage?: string;
  sort?: string;
  order?: string;
  json?: string | true;
};

type ViewOptions = {
  team?: string;
  childTeam?: string;
  json?: string | true;
};

const MEMBER_COLUMNS: Column<Member>[] = [
  {
    header: t("output.colScreenName"),
    value: (member) => member.screen_name,
    color: bold,
  },
  { header: t("output.colName"), value: (member) => member.name },
  // email は常にあるとは限らない。子チームのメンバーでは必ず返るが、
  // 解決できない（有効な id_provider が無い場合など）と null になる。
  { header: t("output.colEmail"), value: (member) => member.email ?? "" },
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

/**
 * --child-team の値。子チーム名は補完のしようがないので、空文字を黙って
 * 親チーム側の呼び出しに落とさず弾く。
 */
function parseChildTeam(raw: string | undefined): string | undefined {
  return raw === undefined ? undefined : nonEmpty(raw, "--child-team");
}

export function registerMemberCommand(program: Command): void {
  const member = program.command("member").description(t("member.desc"));

  member
    .command("list")
    .description(t("member.listDesc"))
    .option("--team <name>", t("member.teamOpt"))
    .option("--child-team <name>", t("member.childTeamOpt"))
    .option("--page <number>", t("member.pageOpt"))
    .option("--per-page <number>", t("member.perPageOpt"))
    .option("--sort <sort>", t("member.sortOpt"))
    .option("--order <order>", t("member.orderOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (options: ListOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      const childTeam = parseChildTeam(options.childTeam);
      const query: MembersQuery = {};
      if (options.page) query.page = positiveInt(options.page, "--page");
      if (options.perPage) {
        query.per_page = positiveInt(options.perPage, "--per-page");
      }
      const sort = serverEnum<NonNullable<MembersQuery["sort"]>>(options.sort);
      const order = serverEnum<NonNullable<MembersQuery["order"]>>(
        options.order,
      );
      if (childTeam !== undefined) {
        // 子チームのメンバー一覧は並び替えを受け付けない。送っても黙って
        // 無視されるだけなので、並んでいるつもりの結果を渡す前に弾く。
        if (sort !== undefined || order !== undefined) {
          throw new Error(t("member.childTeamSortConflict"));
        }
      } else {
        if (sort !== undefined) query.sort = sort;
        if (order !== undefined) query.order = order;
      }

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const payload =
        childTeam === undefined
          ? unwrap(
              await client.GET("/v1/teams/{team_name}/members", {
                params: { path: { team_name: team }, query },
              }),
            )
          : unwrap(
              await client.GET(
                "/v1/teams/{team_name}/child_teams/{child_team_name}/members",
                {
                  params: {
                    path: { team_name: team, child_team_name: childTeam },
                    query,
                  },
                },
              ),
            );
      printList({
        items: payload.members ?? [],
        columns: MEMBER_COLUMNS,
        emptyMessage: t("output.noResults"),
        json: options.json,
        wrapJson: (members) => ({ ...payload, members }),
        pagination: payload,
      });
    });

  member
    .command("view")
    // esa API の GET に合わせて get でも引ける。
    .alias("get")
    .argument("<screen_name_or_email>", t("member.identifierArg"))
    .description(t("member.viewDesc"))
    .option("--team <name>", t("member.teamOpt"))
    .option("--child-team <name>", t("member.childTeamOpt"))
    .option("--json [fields]", t("output.jsonOpt"))
    .action(async (identifier: string, options: ViewOptions) => {
      const screenNameOrEmail = nonEmpty(
        identifier,
        t("member.identifierLabel"),
      );
      const childTeam = parseChildTeam(options.childTeam);

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      const found =
        childTeam === undefined
          ? unwrap(
              await client.GET(
                "/v1/teams/{team_name}/members/{screen_name_or_email}",
                {
                  params: {
                    path: {
                      team_name: team,
                      screen_name_or_email: screenNameOrEmail,
                    },
                  },
                },
              ),
            )
          : unwrap(
              await client.GET(
                "/v1/teams/{team_name}/child_teams/{child_team_name}/members/{screen_name_or_email}",
                {
                  params: {
                    path: {
                      team_name: team,
                      child_team_name: childTeam,
                      screen_name_or_email: screenNameOrEmail,
                    },
                  },
                },
              ),
            );
      printDetail({
        item: found,
        title: found.name,
        fields: [
          {
            key: "screen_name",
            label: t("output.fieldScreenName"),
            value: found.screen_name,
          },
          {
            key: "email",
            label: t("output.fieldEmail"),
            value: found.email ?? "",
          },
          { key: "role", label: t("output.fieldRole"), value: found.role },
          {
            key: "posts_count",
            label: t("output.fieldPosts"),
            value: String(found.posts_count),
          },
          {
            key: "joined_at",
            label: t("output.fieldJoined"),
            value: displayTime(found.joined_at),
          },
          {
            key: "last_accessed_at",
            label: t("output.fieldLastAccess"),
            value: displayTime(found.last_accessed_at),
          },
        ],
        json: options.json,
      });
    });
}
