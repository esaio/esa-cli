import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import { t } from "../i18n/index.js";

// esa API v1 がサポートする HTTP メソッド（GET/POST/PUT/PATCH/DELETE）。
// https://docs.esa.io/posts/102
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// openapi-fetch のメソッド関数を任意パスで呼ぶための最小シグネチャ。型付き
// クライアントはリテラルパスを要求するので、ここでは動的ディスパッチする。
type ClientMethod = (
  url: string,
  init?: {
    params?: { query?: Record<string, string> };
    body?: unknown;
    headers?: Record<string, string>;
  },
) => Promise<{ data?: unknown; error?: unknown; response: Response }>;

/** commander の繰り返しオプションを配列に集める。 */
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** "key=value" 形式の並びをオブジェクトにする（クエリ用）。 */
function parseFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const eq = field.indexOf("=");
    if (eq <= 0) throw new Error(t("api.invalidField", { field }));
    out[field.slice(0, eq)] = field.slice(eq + 1);
  }
  return out;
}

/** "key:value" 形式の並びをヘッダのオブジェクトにする。 */
function parseHeaders(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers) {
    const colon = header.indexOf(":");
    const name = colon < 0 ? "" : header.slice(0, colon).trim();
    if (name === "") throw new Error(t("api.invalidHeader", { header }));
    out[name] = header.slice(colon + 1).trim();
  }
  return out;
}

/** --input（ファイル / "-" で標準入力）から本文を読み、JSON として解釈する。 */
function readBody(input: string): unknown {
  const raw = readFileSync(input === "-" ? 0 : input, "utf-8");
  if (raw.trim() === "") return undefined; // 空入力は本文なし扱い
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(t("api.invalidJson"));
  }
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

type ApiOptions = {
  method?: string;
  field: string[];
  header: string[];
  input?: string;
  team?: string;
};

export function registerApiCommand(program: Command): void {
  program
    .command("api")
    .argument("<path>", t("api.pathArg"))
    .description(t("api.desc"))
    .option("-X, --method <verb>", t("api.methodOpt"))
    .option("-f, --field <key=value>", t("api.fieldOpt"), collect, [])
    .option("-H, --header <key:value>", t("api.headerOpt"), collect, [])
    .option("--input <file>", t("api.inputOpt"))
    .option("--team <name>", t("api.teamOpt"))
    .action(async (pathArg: string, options: ApiOptions) => {
      // 入力の検証・ローカル読み込みはネットワーク（resolveTeam / リクエスト）
      // より先に済ませる。
      // 単一の "/" 始まりのみ許可する。"//host/…" のスキーム相対形は URL 解決の
      // 実装次第で別ホストと解釈される余地があるため拒否する（ベース URL は
      // api.esa.io/localhost に固定済みだが、多層防御として弾いておく）。
      if (!pathArg.startsWith("/") || pathArg.startsWith("//")) {
        throw new Error(t("api.invalidPath", { path: pathArg }));
      }
      const query = parseFields(options.field);
      const headers = parseHeaders(options.header);
      const body =
        options.input !== undefined ? readBody(options.input) : undefined;
      // メソッド未指定なら GET、ただし --input を明示したら POST（gh api と同じ）。
      // 中身が空でも --input があれば POST 扱いにする（body の有無では判定しない）。
      const method = (
        options.method ?? (options.input !== undefined ? "POST" : "GET")
      ).toUpperCase();
      if (!ALLOWED_METHODS.includes(method)) {
        throw new Error(
          t("api.invalidMethod", {
            method,
            allowed: ALLOWED_METHODS.join(", "),
          }),
        );
      }

      const client = createEsaClient();
      // パスに {team} があるときだけチームを解決する（不要な GET /teams を避ける）。
      let path = pathArg;
      if (path.includes("{team}")) {
        const team = await resolveTeam(client, options.team);
        path = path.replaceAll("{team}", team);
      }

      const init: NonNullable<Parameters<ClientMethod>[1]> = {};
      if (Object.keys(query).length > 0) init.params = { query };
      if (body !== undefined) init.body = body;
      if (Object.keys(headers).length > 0) init.headers = headers;

      // createEsaClient はメソッド型クライアント（createClient）なので GET/POST…
      // が呼び出し可能なプロパティになっている。createPathBasedClient に替えると
      // この動的ディスパッチは壊れる点に注意。
      const dispatch = client as unknown as Record<string, ClientMethod>;
      // 許可メソッドでもクライアント側に関数が無ければ、生の TypeError ではなく
      // --method と同じ分かりやすいエラーで落とす。
      const call = dispatch[method];
      if (typeof call !== "function") {
        throw new Error(
          t("api.invalidMethod", {
            method,
            allowed: ALLOWED_METHODS.join(", "),
          }),
        );
      }
      const result = await call(path, init);
      const data = unwrap(result);
      // 204 など本文の無い成功では stdout に何も出さない。
      if (data !== undefined) print(data);
    });
}
