import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { printDetail } from "../detail.js";

const ITEM = {
  number: 123,
  name: "タイトル",
  tags: ["設計"],
  body_md: "# 見出し\n本文",
};

const FIELDS = [
  { key: "wip", label: "State", value: "WIP" },
  { key: "tags", label: "Tags", value: "設計" },
];

const originalStdoutIsTTY = process.stdout.isTTY;

beforeEach(() => {
  process.stdout.isTTY = false;
});

afterEach(() => {
  process.stdout.isTTY = originalStdoutIsTTY;
  vi.restoreAllMocks();
});

test("パイプ時はタブ区切りのキーと値を出し、見出しは出さない", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printDetail({ item: ITEM, title: "出さない", fields: FIELDS });

  expect(log.mock.calls[0][0]).toBe("wip\tWIP\ntags\t設計");
});

test("項目の値に混ざった区切り文字で、行が分裂しない", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printDetail({
    item: ITEM,
    title: "出さない",
    fields: [{ key: "message", label: "Message", value: "one\ttwo\nthree" }],
  });

  expect(log.mock.calls[0][0]).toBe("message\tone two three");
});

test("パイプ時は本文の前に区切りを挟む", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printDetail({
    item: ITEM,
    title: "出さない",
    fields: FIELDS,
    body: ITEM.body_md,
  });

  // どこまでがメタ情報かを機械が判定できるようにする。
  expect(log.mock.calls[0][0]).toBe("wip\tWIP\ntags\t設計\n--\n# 見出し\n本文");
});

test("空の値の印は端末表示にとどめ、パイプ出力には混ぜない", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  printDetail({
    item: ITEM,
    title: "出さない",
    fields: [{ key: "tags", label: "Tags", value: "" }],
  });

  expect(log.mock.calls[0][0]).toBe("tags\t");
});

test("端末では空の値を印に置き換える", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;

  printDetail({
    item: ITEM,
    title: "タイトル",
    fields: [{ key: "tags", label: "Tags", value: "" }],
  });

  expect(stripVTControlCharacters(log.mock.calls[0][0] as string)).toBe(
    ["タイトル", "  - Tags: -"].join("\n"),
  );
});

test("端末では見出しと項目、続けて本文を出す", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;

  printDetail({
    item: ITEM,
    title: "タイトル #123",
    fields: FIELDS,
    body: ITEM.body_md,
  });

  expect(stripVTControlCharacters(log.mock.calls[0][0] as string)).toBe(
    [
      "タイトル #123",
      "  - State: WIP",
      "  - Tags: 設計",
      "",
      // 本文は Markdown のまま。端末から編集元へ貼り戻せるようにする。
      "# 見出し",
      "本文",
    ].join("\n"),
  );
});

test("本文を持たないリソースでは本文の区切りも出さない", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;

  printDetail({ item: ITEM, title: "タイトル", fields: FIELDS });

  expect(stripVTControlCharacters(log.mock.calls[0][0] as string)).toBe(
    ["タイトル", "  - State: WIP", "  - Tags: 設計"].join("\n"),
  );
});

test("本文が空文字なら余計な空行を挟まない", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;

  printDetail({ item: ITEM, title: "タイトル", fields: FIELDS, body: "" });

  expect(stripVTControlCharacters(log.mock.calls[0][0] as string)).toBe(
    ["タイトル", "  - State: WIP", "  - Tags: 設計"].join("\n"),
  );
});

test("--json は端末かどうかに関わらずフィールドを絞る", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  process.stdout.isTTY = true;

  printDetail({
    item: ITEM,
    title: "タイトル",
    fields: FIELDS,
    body: ITEM.body_md,
    json: "number,tags",
  });

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    number: 123,
    tags: ["設計"],
  });
});

test("値なしの --json は候補を並べて指定を促す", () => {
  expect(() =>
    printDetail({ item: ITEM, title: "タイトル", fields: FIELDS, json: true }),
  ).toThrow(/Specify one or more comma-separated fields[\s\S]*body_md/);
});
