import { greenOnStderr, yellowOnStderr } from "./color.js";
import { printJson } from "./json-fields.js";

/** 完了を伝える1行。stdout を汚さないよう stderr に出す。 */
export function printSuccess(message: string): void {
  console.error(`${greenOnStderr("✓")} ${message}`);
}

/** 注意を促す1行。失敗ではないので ✓ とは区別する。 */
export function printNotice(message: string): void {
  console.error(`${yellowOnStderr("!")} ${message}`);
}

/**
 * 変更が済んだ後の JSON 出力。フィールドの絞り込みに失敗しても投げずに
 * false を返す。
 *
 * `--json` のフィールド名は候補を応答から取る都合で、検証が要求の後になる。
 * 綴りの誤りでコマンドを失敗させると、呼び出し側が再試行して同じ変更を
 * 二重に適用しうる。変更そのものは成功しているので、誤りは注意行で伝える。
 */
export function printJsonAfterChange(
  item: object,
  json: string | true,
): boolean {
  try {
    printJson(item, json);
    return true;
  } catch (error) {
    printNotice(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export type MutationOutput<T> = {
  item: T;
  /** stdout に出す URL。作られた・変わったリソースをそのまま辿れる。 */
  url: string;
  /** stderr に出す確認行。 */
  message: string;
  /** `--json` に渡された生の値。未指定なら URL を出す。 */
  json?: string | true;
};

/**
 * 作成・更新の結果を出す。stdout には URL だけを置き、確認行は stderr に回すので
 * `esa post create ... > url.txt` で URL だけを取り出せる。
 * リソース全体が要る場合は `--json` でフィールドを選ぶ。
 */
export function printMutation<T extends object>(
  output: MutationOutput<T>,
): void {
  const { item, url, message, json } = output;

  printSuccess(message);

  if (json !== undefined && printJsonAfterChange(item, json)) return;
  // --json が使えなかったときも、変更したものを辿れるよう URL は出す。
  console.log(url);
}
