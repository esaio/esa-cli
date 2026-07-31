import { expect, test } from "vitest";
import { formatPageSummary } from "../pagination.js";

test("総数・現在ページ・1ページあたりの件数から総ページ数を出す", () => {
  expect(
    formatPageSummary({ total_count: 6654, page: 2, per_page: 30 }, 30),
  ).toBe("Showing 30 of 6654 (page 2/222)");
});

test("端数は切り上げる", () => {
  expect(
    formatPageSummary({ total_count: 61, page: 1, per_page: 30 }, 30),
  ).toBe("Showing 30 of 61 (page 1/3)");
});

test("1ページあたりの件数が無ければ総ページ数を出さない", () => {
  expect(formatPageSummary({ total_count: 6654, page: 2 }, 30)).toBe(
    "Showing 30 of 6654 (page 2)",
  );
});

test("現在ページが無ければ件数だけを出す", () => {
  expect(formatPageSummary({ total_count: 300 }, 300)).toBe(
    "Showing 300 of 300",
  );
});

test("総数が無ければ何も言えないので undefined", () => {
  expect(formatPageSummary({ page: 2, per_page: 30 }, 30)).toBeUndefined();
});

test("0 件でも 1 ページ目は存在する", () => {
  expect(formatPageSummary({ total_count: 0, page: 1, per_page: 30 }, 0)).toBe(
    "Showing 0 of 0 (page 1/1)",
  );
});

test("範囲外のページでは総ページ数を超えた現在ページをそのまま出す", () => {
  expect(
    formatPageSummary({ total_count: 61, page: 99, per_page: 30 }, 0),
  ).toBe("Showing 0 of 61 (page 99/3)");
});
