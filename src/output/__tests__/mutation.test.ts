import { stripVTControlCharacters } from "node:util";
import { afterEach, expect, test, vi } from "vitest";
import { printMutation, printNotice, printSuccess } from "../mutation.js";

const ITEM = {
  number: 14187,
  full_name: "日報/2026/07/27/新しい記事",
  url: "https://ware2.esa.io/posts/14187",
};

afterEach(() => {
  vi.restoreAllMocks();
});

test("stdout は URL だけ、確認行は stderr に回す", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  printMutation({ item: ITEM, url: ITEM.url, message: "Created #14187" });

  // `esa post create ... > url.txt` で URL だけを取り出せるようにする。
  expect(log.mock.calls).toEqual([["https://ware2.esa.io/posts/14187"]]);
  expect(stripVTControlCharacters(error.mock.calls[0][0] as string)).toBe(
    "✓ Created #14187",
  );
});

test("--json を指定すると URL の代わりに絞った JSON を出す", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  printMutation({
    item: ITEM,
    url: ITEM.url,
    message: "Created #14187",
    json: "number,url",
  });

  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
    number: 14187,
    url: "https://ware2.esa.io/posts/14187",
  });
});

test("--json でも確認行は stderr に出す", () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  printMutation({
    item: ITEM,
    url: ITEM.url,
    message: "Created #14187",
    json: "number",
  });

  expect(error).toHaveBeenCalledOnce();
});

test("notice でも出力の形は変わらず、記号だけが変わる", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  printMutation({
    item: ITEM,
    url: ITEM.url,
    message: "Already archived",
    notice: true,
    json: "number",
  });

  // --json の扱いが対象の状態で変わると、呼び出し側が分岐させられる。
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ number: 14187 });
  expect(stripVTControlCharacters(error.mock.calls[0][0] as string)).toBe(
    "! Already archived",
  );
});

test("--json の指定が誤っていても、変更後は失敗させず URL を出す", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  // 投げると呼び出し側が再試行し、同じ変更を二重に適用しうる。
  expect(() =>
    printMutation({
      item: ITEM,
      url: ITEM.url,
      message: "Created #14187",
      json: "nunber",
    }),
  ).not.toThrow();

  expect(log.mock.calls).toEqual([["https://ware2.esa.io/posts/14187"]]);
  const notices = error.mock.calls.map((call) =>
    stripVTControlCharacters(call[0] as string),
  );
  expect(notices[0]).toBe("✓ Created #14187");
  expect(notices[1]).toMatch(/^! Unknown JSON field: nunber/);
});

test("完了と、変更が要らなかったことは記号で区別する", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  printSuccess("Deleted post #5.");
  printNotice("Post #9 is already archived.");

  const lines = error.mock.calls.map((call) =>
    stripVTControlCharacters(call[0] as string),
  );
  expect(lines).toEqual([
    "✓ Deleted post #5.",
    "! Post #9 is already archived.",
  ]);
});
