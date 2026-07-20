import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import type { paths } from "../generated/api-types.js";
import { t } from "../i18n/index.js";

type SignedUrlsQuery = NonNullable<
  paths["/v1/teams/{team_name}/signed_urls"]["get"]["parameters"]["query"]
>;

// 署名付きURLが必要なホスト。files.esa.io / dl.esa.io は API 経由で署名する。
// img.esa.io は公開なので署名不要で直接取得できる。
const SIGNED_URL_HOSTS = ["files.esa.io", "dl.esa.io"];

const EXPIRES_IN_MIN = 1;
const EXPIRES_IN_MAX = 604800;

// GET /signed_urls は一度に最大10件まで（カンマ区切り）。署名は read 操作として
// 扱いたいので、write 権限を要求する POST ではなく GET を使う。
const MAX_SIGN_URLS = 10;

/** 署名付きURLの有効期限（秒）を 1〜604800 の範囲で検証する。 */
function expiresInSeconds(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < EXPIRES_IN_MIN || n > EXPIRES_IN_MAX) {
    throw new Error(t("attachment.expiresInRange", { value }));
  }
  return n;
}

/** 署名が必要なURLかどうか。パス（/uploads/...）と secure なホストは要署名。 */
function needsSignedUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    return SIGNED_URL_HOSTS.includes(new URL(url).hostname);
  } catch {
    // URL として解釈できないものはパス扱いで署名対象にする。
    return true;
  }
}

/** フルURLならパス部分を、既にパスならそのまま返す（署名API入力用）。 */
function normalizeUrl(url: string): string {
  if (url.startsWith("/")) return url;
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

type SignOptions = { team?: string; expiresIn?: string };
type DownloadOptions = { team?: string; expiresIn?: string; output?: string };

export function registerAttachmentCommand(program: Command): void {
  const attachment = program
    .command("attachment")
    .description(t("attachment.desc"));

  attachment
    .command("sign")
    .argument("<url...>", t("attachment.urlArg"))
    .description(t("attachment.signDesc"))
    .option("--team <name>", t("attachment.teamOpt"))
    .option("--expires-in <seconds>", t("attachment.expiresInOpt"))
    .action(async (urls: string[], options: SignOptions) => {
      // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
      if (urls.length > MAX_SIGN_URLS) {
        throw new Error(t("attachment.tooManyUrls", { max: MAX_SIGN_URLS }));
      }
      const expiresIn = options.expiresIn
        ? expiresInSeconds(options.expiresIn)
        : undefined;

      const client = createEsaClient();
      const team = await resolveTeam(client, options.team);
      // urls は URI としてサーバ側でパスに解決されるため、パス・フルURLのどちらでも可。
      const query: SignedUrlsQuery = { urls: urls.join(","), v: 2 };
      if (expiresIn !== undefined) query.expires_in = expiresIn;
      const result = await client.GET("/v1/teams/{team_name}/signed_urls", {
        params: { path: { team_name: team }, query },
      });
      console.log(JSON.stringify(unwrap(result), null, 2));
    });

  attachment
    .command("download")
    .argument("<url>", t("attachment.urlArg"))
    .description(t("attachment.downloadDesc"))
    .option("--team <name>", t("attachment.teamOpt"))
    .option("--expires-in <seconds>", t("attachment.expiresInOpt"))
    .option("-o, --output <path>", t("attachment.outputOpt"))
    .action(async (url: string, options: DownloadOptions) => {
      let fetchUrl = url;
      // 署名が必要なURLだけ signed_urls で解決する。img.esa.io などは直接取得。
      // --expires-in は署名時のみ意味を持つので、この分岐の中で検証する。
      if (needsSignedUrl(url)) {
        // 入力の検証はネットワーク（resolveTeam の GET /v1/teams）より先に行う。
        const expiresIn = options.expiresIn
          ? expiresInSeconds(options.expiresIn)
          : undefined;
        const client = createEsaClient();
        const team = await resolveTeam(client, options.team);
        const query: SignedUrlsQuery = { urls: normalizeUrl(url), v: 2 };
        if (expiresIn !== undefined) query.expires_in = expiresIn;
        const result = await client.GET("/v1/teams/{team_name}/signed_urls", {
          params: { path: { team_name: team }, query },
        });
        const signed = unwrap(result).signed_urls?.[0]?.[1];
        if (!signed) {
          throw new Error(t("attachment.notFound", { url: query.urls }));
        }
        fetchUrl = signed;
      }

      const response = await fetch(fetchUrl);
      if (!response.ok || !response.body) {
        throw new Error(
          t("attachment.fetchFailed", {
            status: response.status,
            statusText: response.statusText,
          }),
        );
      }

      // 大きな添付でもメモリに載せないよう、応答をそのまま書き出しへ流す。
      const source = Readable.fromWeb(response.body);
      if (options.output) {
        await pipeline(source, createWriteStream(options.output));
        const { size } = await stat(options.output);
        // ファイル保存の報告は人間向けなので stderr。stdout はデータ専用に空ける。
        console.error(
          t("attachment.saved", { bytes: size, path: options.output }),
        );
      } else {
        // process.stdout は閉じないよう end:false で流す。
        await pipeline(source, process.stdout, { end: false });
      }
    });
}
