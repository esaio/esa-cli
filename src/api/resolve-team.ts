import type { Client } from "openapi-fetch";
import { getDefaultTeam } from "../config/file-store.js";
import type { paths } from "../generated/api-types.js";
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

  const data = unwrap(await client.GET("/v1/teams"));
  const teams = data.teams ?? [];
  if (teams.length === 1) return teams[0].name;
  if (teams.length === 0) {
    throw new Error("所属しているチームがありません。");
  }
  throw new Error(
    `複数のチームに所属しています。--team で指定するか、` +
      `\`esa config set default-team <name>\` で既定を設定してください。\n` +
      `所属チーム: ${teams.map((t) => t.name).join(", ")}`,
  );
}
