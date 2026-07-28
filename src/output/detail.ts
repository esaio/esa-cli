import { bold, dim } from "./color.js";
import { printJson } from "./json-fields.js";
import { isStdoutTTY } from "./stream.js";
import { displayValue, singleLine } from "./value.js";

/** 本文の始まりを示す区切り。どこまでがメタ情報かを機械が判定できる。 */
const BODY_SEPARATOR = "--";

/**
 * 端末向けの項目行。独自の見出しを持つ表示（auth status）とも形を揃えるため、
 * printDetail の内部に閉じずに公開する。
 */
export function fieldLine(label: string, value: string): string {
  return `  ${dim("-")} ${label}: ${displayValue(singleLine(value))}`;
}

export type DetailField = {
  /** パイプ時に出すキー。機械が読むので翻訳せず、API のフィールド名に揃える。 */
  key: string;
  /** 端末表示時のラベル。 */
  label: string;
  value: string;
};

export type DetailOutput<T> = {
  item: T;
  /** 端末表示の見出し。パイプ時はキーと値だけを出すので使わない。 */
  title: string;
  fields: readonly DetailField[];
  /**
   * 本文（Markdown）。描画せずそのまま出す。Markdown は元から読める形式で、
   * 端末から編集元へ貼り戻す用途でも生のほうが使える。
   * 描画するなら esa 固有の記法を解決済みの body_html を入力にすべきだが、
   * HTML の解析と整形が要る割に得られるものが少ない。
   */
  body?: string;
  /** `--json` に渡された生の値。未指定なら既定の表示にする。 */
  json?: string | true;
};

/**
 * 単一リソースの出力。端末なら見出し付きの読みやすい形、パイプならタブ区切りの
 * キーと値、`--json` ならフィールドを絞った JSON を出す。
 * JSON は `--json` を指定したときだけという規則を、一覧・変更系と揃える。
 */
export function printDetail<T extends object>(output: DetailOutput<T>): void {
  const { item, title, fields, body, json } = output;

  if (json !== undefined) {
    printJson(item, json);
    return;
  }

  const hasBody = body !== undefined && body.length > 0;
  const lines: string[] = [];

  if (isStdoutTTY()) {
    lines.push(bold(title));
    for (const field of fields) {
      lines.push(fieldLine(field.label, field.value));
    }
    if (hasBody) lines.push("", body);
  } else {
    // 本文は -- の後に多行のまま出すので、均すのは項目の値だけ。
    for (const field of fields) {
      lines.push(`${field.key}\t${singleLine(field.value)}`);
    }
    if (hasBody) lines.push(BODY_SEPARATOR, body);
  }

  console.log(lines.join("\n"));
}
