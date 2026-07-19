import { readFileSync } from "node:fs";
import type { Command } from "commander";
import { createEsaClient } from "../api/client.js";
import { resolveTeam } from "../api/resolve-team.js";
import { unwrap } from "../api/response.js";
import { t } from "../i18n/index.js";

// esa API がボディを受け付ける HTTP メソッド。GET/HEAD/OPTIONS を除く。
const ALLOWED_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

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
    if (eq < 0) throw new Error(t("api.invalidField", { field }));
    out[field.slice(0, eq)] = field.slice(eq + 1);
  }
  return out;
}

/** "key:value" 形式の並びをヘッダのオブジェクトにする。 */
function parseHeaders(headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers) {
    const colon = header.indexOf(":");
    if (colon < 0) throw new Error(t("api.invalidHeader", { header }));
    out[header.slice(0, colon).trim()] = header.slice(colon + 1).trim();
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
    .argument("<endpoint>", t("api.endpointArg"))
    .description(t("api.desc"))
    .option("-X, --method <verb>", t("api.methodOpt"))
    .option("-f, --field <key=value>", t("api.fieldOpt"), collect, [])
    .option("-H, --header <key:value>", t("api.headerOpt"), collect, [])
    .option("--input <file>", t("api.inputOpt"))
    .option("--team <name>", t("api.teamOpt"))
    .action(async (endpointArg: string, options: ApiOptions) => {
      // 入力の検証・ローカル読み込みはネットワーク（resolveTeam / リクエスト）
      // より先に済ませる。
      if (!endpointArg.startsWith("/")) {
        throw new Error(t("api.invalidEndpoint", { endpoint: endpointArg }));
      }
      const query = parseFields(options.field);
      const headers = parseHeaders(options.header);
      const body =
        options.input !== undefined ? readBody(options.input) : undefined;
      // メソッド未指定なら GET、ただし本文があれば POST（gh api と同じ）。
      const method = (
        options.method ?? (body !== undefined ? "POST" : "GET")
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
      let endpoint = endpointArg;
      if (endpoint.includes("{team}")) {
        const team = await resolveTeam(client, options.team);
        endpoint = endpoint.replaceAll("{team}", team);
      }

      const init: NonNullable<Parameters<ClientMethod>[1]> = {};
      if (Object.keys(query).length > 0) init.params = { query };
      if (body !== undefined) init.body = body;
      if (Object.keys(headers).length > 0) init.headers = headers;

      const dispatch = client as unknown as Record<string, ClientMethod>;
      const result = await dispatch[method](endpoint, init);
      const data = unwrap(result);
      // 204 など本文の無い成功では stdout に何も出さない。
      if (data !== undefined) print(data);
    });
}
