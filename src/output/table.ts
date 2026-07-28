import cliTruncate from "cli-truncate";
import stringWidth from "string-width";
import { isStdoutTTY, terminalWidth } from "./stream.js";
import { singleLine } from "./value.js";

/** 列の区切り。端末表示でのみ使う（TSV はタブ区切り）。 */
const DELIMITER = "  ";

/**
 * 幅が足りないときでも、列が消えてしまわないよう確保する最低幅。
 * これを配ると行が端末幅を超えることがあるが、折り返しは目に見えて直せる一方、
 * 列の消失は「値が無い」のか「入り切らない」のか区別できないため、超過を採る。
 */
const MIN_FLEX_WIDTH = 1;

export type Field = {
  text: string;
  /**
   * 端末表示時の装飾。TSV 出力では呼ばれないため、機械可読な出力に
   * エスケープシーケンスが混ざることはない。
   */
  color?: (value: string) => string;
  /**
   * false にすると、その列は切り詰めずに全体の自然幅を確保する。
   * 設定は列全体に効くので、見出しだけが切られることはない。
   */
  truncate?: boolean;
};

export type Row = readonly (Field | string)[];

export interface TablePrinter {
  /** 見出し行。TSV 出力では捨てられる（列位置での処理を壊さないため）。 */
  addHeader(columns: Row): void;
  addRow(fields: Row): void;
  /** 行が無ければ空文字列を返す。末尾は改行で終わる。 */
  render(): string;
}

export type TableOptions = {
  isTTY?: boolean;
  maxWidth?: number;
};

/**
 * 端末なら桁揃えされた人間向けのテーブル、そうでなければタブ区切りを返す。
 * 呼び出し側はどちらであるかを意識せず addRow / render を使える。
 */
export function createTablePrinter(options: TableOptions = {}): TablePrinter {
  const isTTY = options.isTTY ?? isStdoutTTY();
  return isTTY
    ? new TtyTablePrinter(options.maxWidth ?? terminalWidth())
    : new TsvTablePrinter();
}

function toField(field: Field | string): Field {
  const base = typeof field === "string" ? { text: field } : field;
  // 表は1行1件なので、値に混ざった区切り文字はここで均す。
  return { ...base, text: singleLine(base.text) };
}

function padRight(width: number, value: string): string {
  const pad = width - stringWidth(value);
  return pad > 0 ? value + " ".repeat(pad) : value;
}

/**
 * タブ区切り。見出しは出さず、切り詰めも装飾も行わない。
 * `cut -f2` のような列位置に依存する処理が壊れないことを優先する。
 */
class TsvTablePrinter implements TablePrinter {
  private readonly rows: string[][] = [];

  addHeader(): void {}

  addRow(fields: Row): void {
    this.rows.push(fields.map((field) => toField(field).text));
  }

  render(): string {
    return this.rows.map((row) => `${row.join("\t")}\n`).join("");
  }
}

/**
 * 端末幅に収まるよう列幅を配分して桁揃えする。
 * 幅の計算は文字数ではなく表示幅で行う（日本語や絵文字は2桁を占める）。
 */
class TtyTablePrinter implements TablePrinter {
  private readonly rows: Field[][] = [];

  constructor(private readonly maxWidth: number) {}

  addHeader(columns: Row): void {
    this.addRow(columns);
  }

  addRow(fields: Row): void {
    this.rows.push(fields.map(toField));
  }

  render(): string {
    if (this.rows.length === 0) return "";

    const numCols = this.columnCount();
    const fixed = this.fixedColumns(numCols);
    const widths = this.columnWidths(numCols, fixed);

    let out = "";
    for (const row of this.rows) {
      for (const [col, field] of row.entries()) {
        if (col > 0) out += DELIMITER;
        // 切り詰め → パディング → 装飾の順。装飾を最後に当てることで
        // エスケープシーケンスが幅の計算に混ざらない。
        let value = fixed[col]
          ? field.text
          : cliTruncate(field.text, widths[col]);
        if (col < numCols - 1) value = padRight(widths[col], value);
        if (field.color) value = field.color(value);
        out += value;
      }
      out += "\n";
    }
    return out;
  }

  /**
   * 列数。見出しではなく最も長い行に合わせる。見出しの列数を基準にすると、
   * それより長い行の幅が未定義になり、分かりにくい例外で落ちる。
   */
  private columnCount(): number {
    return Math.max(...this.rows.map((row) => row.length));
  }

  /**
   * 切り詰めない列。1つでも truncate:false の値があればその列全体に効かせる。
   * 見出しにも同じ指定を書かせると、指定漏れで見出しだけ切られてしまう。
   */
  private fixedColumns(numCols: number): boolean[] {
    const fixed: boolean[] = new Array(numCols).fill(false);
    for (const row of this.rows) {
      for (const [col, field] of row.entries()) {
        if (field.truncate === false) fixed[col] = true;
      }
    }
    return fixed;
  }

  /**
   * 列幅を決める。切り詰めない列に自然幅を確保したうえで、残り幅を
   * 「自然幅が公平配分より狭い列はその自然幅で確定 → 残りを公平配分 →
   * 余りを切り詰められた列へ配り直す」の順に割り当てる。
   */
  private columnWidths(numCols: number, fixed: boolean[]): number[] {
    const maxColWidths: number[] = new Array(numCols).fill(0);
    const colWidths: number[] = new Array(numCols).fill(0);

    for (const row of this.rows) {
      for (const [col, field] of row.entries()) {
        const width = stringWidth(field.text);
        if (width > maxColWidths[col]) maxColWidths[col] = width;
      }
    }
    for (let col = 0; col < numCols; col++) {
      if (fixed[col]) colWidths[col] = maxColWidths[col];
    }

    const availWidth = () =>
      this.maxWidth -
      DELIMITER.length * (numCols - 1) -
      colWidths.reduce((sum, width) => sum + width, 0);
    const numFlexCols = () => colWidths.filter((width) => width === 0).length;

    // 短い列は公平配分まで広げず、自然幅のまま確定させる。
    if (availWidth() > 0 && numFlexCols() > 0) {
      const perColumn = Math.trunc(availWidth() / numFlexCols());
      for (let col = 0; col < numCols; col++) {
        if (maxColWidths[col] < perColumn) colWidths[col] = maxColWidths[col];
      }
    }

    // 残った長い列に、余っている幅を均等に配る。
    if (numFlexCols() > 0) {
      const perColumn = Math.trunc(availWidth() / numFlexCols());
      for (let col = 0; col < numCols; col++) {
        if (colWidths[col] !== 0) continue;
        if (maxColWidths[col] < perColumn) {
          colWidths[col] = maxColWidths[col];
        } else if (maxColWidths[col] > 0) {
          // 切り詰めない列が幅を占めると配分が 0 以下になりうる。最低幅を
          // 確保して切り詰めた印を残す（行が端末幅を超えることは許容する）。
          colWidths[col] = Math.max(perColumn, MIN_FLEX_WIDTH);
        }
      }
    }

    // 割り切れずに余った幅を、切り詰められた列へ順に返す。
    let remainder = availWidth();
    for (let col = 0; col < numCols && remainder > 0; col++) {
      const shortfall = maxColWidths[col] - colWidths[col];
      const toAdd = Math.min(remainder, shortfall);
      colWidths[col] += toAdd;
      remainder -= toAdd;
    }

    return colWidths;
  }
}
