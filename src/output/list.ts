import { dimOnStderr, underlineHeader } from "./color.js";
import { projectItems } from "./json-fields.js";
import { formatPageSummary, type PageInfo } from "./pagination.js";
import { isStdoutTTY } from "./stream.js";
import { createTablePrinter } from "./table.js";
import { displayValue } from "./value.js";

export type Column<T> = {
  header: string;
  value: (item: T) => string;
  /**
   * 端末表示時の装飾。タブ区切りでは使われない。値は桁揃え済みで渡るため、
   * 装飾を値の内容で変えたい場合は文字列ではなく item を見る。
   */
  color?: (value: string, item: T) => string;
  /**
   * false にすると、その列は切り詰めない。番号や ID のように、
   * 途中で切ると意味を失うものに使う。
   */
  truncate?: boolean;
};

export type ListOutput<T> = {
  items: readonly T[];
  columns: readonly Column<T>[];
  /** 該当なしのときに端末へ出す案内。パイプ時は何も出さない。 */
  emptyMessage: string;
  /** `--json` に渡された生の値。未指定なら既定の表示にする。 */
  json?: string | true;
  /**
   * `--json` で絞り込んだ結果を包む。ページ情報を持つ応答で、絞り込みとは
   * 無関係に必要な次ページの有無などを残すために使う。
   */
  wrapJson?: (projected: Record<string, unknown>[]) => unknown;
  /**
   * ページ情報を持つ応答。端末に件数と現在ページを出すために使う。
   * 表からは「これで全部なのか1ページ目なのか」が判別できないため、
   * 続きの有無にかかわらず出す。
   */
  pagination?: PageInfo;
};

/**
 * 一覧の出力。端末なら桁を揃えたテーブル、パイプならタブ区切り、
 * `--json` ならフィールドを絞った JSON を出す。
 * 一覧を出すコマンドはすべてここを通し、表示の差が列の定義だけに収まるようにする。
 */
export function printList<T extends object>(output: ListOutput<T>): void {
  const { items, columns, emptyMessage, json, wrapJson, pagination } = output;

  if (json !== undefined) {
    const projected = projectItems(items, json);
    console.log(
      JSON.stringify(wrapJson ? wrapJson(projected) : projected, null, 2),
    );
    return;
  }

  const isTTY = isStdoutTTY();
  if (items.length === 0) {
    // stdout は空のままにして、パイプの下流に見出しだけが流れないようにする。
    if (isTTY) {
      console.error(emptyMessage);
      // 総数があるのにここが空なのは、範囲外のページを見ているとき。
      // 「無い」ではなく「そのページには無い」だと分かるように件数を添える。
      if (pagination?.total_count) printPageSummary(pagination, 0);
    }
    return;
  }

  const table = createTablePrinter();
  table.addHeader(
    columns.map((column) => ({
      text: column.header,
      color: underlineHeader,
    })),
  );
  for (const item of items) {
    table.addRow(
      columns.map((column) => ({
        // 空セルの印は端末表示のときだけ。タブ区切りは機械が読むのでそのまま。
        text: isTTY ? displayValue(column.value(item)) : column.value(item),
        color:
          column.color && ((value) => column.color?.(value, item) ?? value),
        truncate: column.truncate,
      })),
    );
  }
  process.stdout.write(table.render());
  if (isTTY && pagination) printPageSummary(pagination, items.length);
}

/** 件数と現在ページを表と1行空けて stderr に出す。表示は端末のときだけ。 */
function printPageSummary(pagination: PageInfo, shown: number): void {
  const summary = formatPageSummary(pagination, shown);
  if (summary === undefined) return;
  console.error(`\n${dimOnStderr(summary)}`);
}
