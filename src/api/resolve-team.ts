import type { Client } from "openapi-fetch";
import { getDefaultTeam } from "../config/file-store.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";
import { unwrap } from "./response.js";

/**
 * 対象チームを決める。優先順位は:
 *   1. --team フラグ
 *   2. 環境変数 ESA_TEAM
 *   3. 設定ファイルの default_team（esa config set default-team）
 *   4. 所属チームが1つだけならそれ
 *   5. どれも決まらなければエラー（複数所属で未指定）
 */
export async function resolveTeam(
  client: Client<paths>,
  flagTeam?: string,
): Promise<string> {
  // 空文字（ESA_TEAM="" など）は未指定として次の候補へ進める。
  const flag = flagTeam?.trim();
  if (flag) return flag;
  const env = process.env.ESA_TEAM?.trim();
  if (env) return env;

  const configured = getDefaultTeam()?.trim();
  if (configured) return configured;

  const result = await client.GET("/v1/teams");
  // 所属チームを調べるためだけに read:team を使う。スコープを絞ったトークンでは
  // ここで 403 になるが、対象チームが分かっていれば要らない問い合わせなので、
  // スコープを足し直すより先にチームを直接指定する道を案内する。
  if (result.response.status === 403) {
    throw new Error(t("resolveTeam.forbidden"));
  }
  const data = unwrap(result);
  const teams = data.teams ?? [];
  if (teams.length === 1) return teams[0].name;
  if (teams.length === 0) {
    throw new Error(t("resolveTeam.noTeams"));
  }
  throw new Error(
    t("resolveTeam.multipleTeams", {
      teams: teams.map((team) => team.name).join(", "),
    }),
  );
}
