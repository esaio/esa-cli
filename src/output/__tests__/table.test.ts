import stringWidth from "string-width";
import { expect, test } from "vitest";
import { createTablePrinter } from "../table.js";

/** 装飾の適用順を確かめるための、幅を持たない目印。 */
const mark = (value: string) => `<${value}>`;

function tty(maxWidth: number) {
  return createTablePrinter({ isTTY: true, maxWidth });
}

test("TSV は見出しを出さず、タブ区切りで値をそのまま並べる", () => {
  const table = createTablePrinter({ isTTY: false });
  table.addHeader(["NUMBER", "TITLE"]);
  table.addRow([
    { text: "14184", color: mark },
    { text: "日報/2026/07/26/esa-cli微調整", color: mark },
  ]);

  // 列位置に依存する下流処理を壊さないため、見出しも装飾も入らない。
  expect(table.render()).toBe("14184\t日報/2026/07/26/esa-cli微調整\n");
});

test("TSV は端末幅に関係なく切り詰めない", () => {
  const table = createTablePrinter({ isTTY: false });
  table.addRow([{ text: "あ".repeat(50) }, { text: "x" }]);

  expect(table.render()).toBe(`${"あ".repeat(50)}\tx\n`);
});

test("値に混ざった区切り文字で、列や行が分裂しない", () => {
  const table = createTablePrinter({ isTTY: false });
  table.addRow(["1", "first\tsecond\nnext line", "ok"]);

  // タブや改行がそのまま出ると cut -fN が別の列を拾ってしまう。
  expect(table.render()).toBe("1\tfirst second next line\tok\n");
});

test("行が無ければ空文字列を返す", () => {
  expect(tty(80).render()).toBe("");
  expect(createTablePrinter({ isTTY: false }).render()).toBe("");
});

test("端末では列を最長の値に合わせて揃え、最後の列は右を詰めない", () => {
  const table = tty(40);
  table.addHeader(["A", "B"]);
  table.addRow(["long-value", "x"]);

  expect(table.render()).toBe(
    ["A           B", "long-value  x"].join("\n").concat("\n"),
  );
});

test("列幅は文字数ではなく表示幅で決まる", () => {
  const table = tty(40);
  // "あいう" は3文字だが6桁を占めるので、ASCII 6文字と同じ幅に揃う。
  table.addRow(["あいう", "x"]);
  table.addRow(["abcdef", "y"]);

  const [first, second] = table.render().split("\n");
  expect(stringWidth(first)).toBe(stringWidth(second));
  expect(first.startsWith("あいう  ")).toBe(true);
});

test("端末幅に収まらない列は切り詰められる", () => {
  const table = tty(20);
  table.addRow(["あ".repeat(30), "x"]);

  const line = table.render().trimEnd();
  expect(stringWidth(line)).toBeLessThanOrEqual(20);
  expect(line.endsWith("…  x")).toBe(true);
});

test("truncate:false の列は見出しも含めて切り詰めない", () => {
  const table = tty(24);
  // 見出しの方が値より長い。列指定なので、見出しだけ切られることはない。
  table.addHeader(["NUMBER", "TITLE"]);
  table.addRow([{ text: "14184", truncate: false }, { text: "あ".repeat(30) }]);

  const [header, row] = table.render().split("\n");
  expect(header.startsWith("NUMBER  ")).toBe(true);
  expect(row.startsWith("14184   ")).toBe(true);
});

test("列数が揃っていなくても落ちない", () => {
  const table = tty(40);
  // 見出しより長い行。列数を見出し基準にすると幅が未定義になり例外で落ちる。
  table.addHeader(["A", "B"]);
  table.addRow(["x", "y", "z"]);
  table.addRow(["p"]);

  // 足りない列は詰めずに行を終える（余分な区切りを出さない）。
  expect(table.render()).toBe(["A  B", "x  y  z", "p", ""].join("\n"));
});

test("幅が足りなければ端末幅を超えてでも、列を消さない", () => {
  const maxWidth = 20;
  const table = tty(maxWidth);
  // 切り詰めない列が幅を占めると、残りへの配分が 0 以下になりうる。
  table.addHeader(["ID", "POST", "BODY", "AUTHOR", "CREATED"]);
  table.addRow([
    { text: "1234567", truncate: false },
    { text: "4321", truncate: false },
    { text: "Hello world this is a comment body" },
    { text: "someone" },
    { text: "2 hours ago" },
  ]);

  const lines = table.render().trimEnd().split("\n");
  // 値が無いのか入り切らないのかを区別できるよう、切り詰めた印を残す。
  expect(lines).toEqual(["ID       POST  …  …  …", "1234567  4321  …  …  …"]);
  // 収まらない場合は折り返しを選ぶ。列の消失より回復しやすいため。
  expect(stringWidth(lines[0])).toBeGreaterThan(maxWidth);
});

test("装飾はパディングの後に当てる（エスケープが幅計算に混ざらないように）", () => {
  const table = tty(40);
  table.addRow([{ text: "ab", color: mark }, "x"]);
  table.addRow(["abcd", "y"]);

  // 4桁に揃えたうえで装飾するため、目印の内側に詰めた空白が入る。
  expect(table.render().split("\n")[0]).toBe("<ab  >  x");
});
