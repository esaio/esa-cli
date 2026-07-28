import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { captureStdout } from "../../test-utils/stdout.js";
import { type Column, printList } from "../list.js";

type Row = { id: number; title: string; wip: boolean };

const ROWS: Row[] = [
  { id: 1, title: "あいうえお", wip: true },
  { id: 22, title: "second", wip: false },
];

const COLUMNS: Column<Row>[] = [
  { header: "ID", value: (row) => String(row.id), truncate: false },
  { header: "TITLE", value: (row) => row.title },
];

const originalStdoutIsTTY = process.stdout.isTTY;
const originalColumns = process.stdout.columns;

beforeEach(() => {
  process.stdout.isTTY = false;
});

afterEach(() => {
  process.stdout.isTTY = originalStdoutIsTTY;
  process.stdout.columns = originalColumns;
  vi.restoreAllMocks();
});

test("パイプ時は見出しなしのタブ区切りを出す", () => {
  const { output } = captureStdout();

  printList({ items: ROWS, columns: COLUMNS, emptyMessage: "none" });

  expect(output()).toBe("1\tあいうえお\n22\tsecond\n");
});

test("端末では見出し付きで桁を揃える", () => {
  const { output } = captureStdout();
  process.stdout.isTTY = true;
  process.stdout.columns = 60;

  printList({ items: ROWS, columns: COLUMNS, emptyMessage: "none" });

  expect(stripVTControlCharacters(output())).toBe(
    ["ID  TITLE", "1   あいうえお", "22  second", ""].join("\n"),
  );
});

test("装飾は item を見て決められる", () => {
  const { output } = captureStdout();
  process.stdout.isTTY = true;
  process.stdout.columns = 60;
  const columns: Column<Row>[] = [
    {
      header: "STATE",
      value: (row) => (row.wip ? "WIP" : "Ship"),
      // 値ではなく item を見るので、桁揃えの空白に左右されない。
      color: (value, row) => (row.wip ? `<${value}>` : value),
      truncate: false,
    },
  ];

  printList({ items: ROWS, columns, emptyMessage: "none" });

  // 見出しの装飾は外し、列側で付けた目印だけを見る。
  expect(stripVTControlCharacters(output())).toBe(
    ["STATE", "<WIP>", "Ship", ""].join("\n"),
  );
});

test("空の値の印は端末表示にとどめ、パイプ出力には混ぜない", () => {
  const { output } = captureStdout();
  const columns: Column<Row>[] = [
    { header: "TITLE", value: () => "" },
    { header: "ID", value: (row) => String(row.id) },
  ];

  printList({ items: ROWS, columns, emptyMessage: "none" });

  // 機械が読む側は、API が返したとおりの空文字であるべき。
  expect(output()).toBe("\t1\n\t22\n");
});

test("端末では空の値を印に置き換える", () => {
  const { output } = captureStdout();
  process.stdout.isTTY = true;
  process.stdout.columns = 60;
  const columns: Column<Row>[] = [
    { header: "TITLE", value: () => "" },
    { header: "ID", value: (row) => String(row.id) },
  ];

  printList({ items: ROWS, columns, emptyMessage: "none" });

  // 値が無いのか表示が壊れたのかを区別できるようにする。
  expect(stripVTControlCharacters(output())).toBe(
    ["TITLE  ID", "-      1", "-      22", ""].join("\n"),
  );
});

test("該当なしのとき、パイプでは何も出さない", () => {
  const { output } = captureStdout();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  printList({ items: [], columns: COLUMNS, emptyMessage: "none" });

  expect(output()).toBe("");
  expect(error).not.toHaveBeenCalled();
});

test("該当なしのとき、端末にだけ案内を出す", () => {
  const { output } = captureStdout();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  process.stdout.isTTY = true;
  process.stdout.columns = 60;

  printList({ items: [], columns: COLUMNS, emptyMessage: "none" });

  expect(output()).toBe("");
  expect(error).toHaveBeenCalledWith("none");
});

test("--json は列定義ではなく応答のフィールドを絞る", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printList({
    items: ROWS,
    columns: COLUMNS,
    emptyMessage: "none",
    json: "id,wip",
  });

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual([
    { id: 1, wip: true },
    { id: 22, wip: false },
  ]);
});

test("wrapJson を渡すとページ情報を保ったまま絞り込める", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printList({
    items: ROWS,
    columns: COLUMNS,
    emptyMessage: "none",
    json: "id",
    wrapJson: (rows) => ({ rows, next_page: 2, total_count: 99 }),
  });

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    rows: [{ id: 1 }, { id: 22 }],
    next_page: 2,
    total_count: 99,
  });
});
