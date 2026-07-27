import { expect, test } from "vitest";
import { relativeTime } from "../time.js";

const now = new Date("2026-07-26T12:00:00Z");

test("過去は「〜前」として表す", () => {
  expect(relativeTime("2026-07-26T10:00:00Z", now)).toBe("2 hours ago");
  expect(relativeTime("2026-07-25T12:00:00Z", now)).toBe("yesterday");
  expect(relativeTime("2026-03-26T12:00:00Z", now)).toBe("4 months ago");
});

test("未来は「〜後」として表す（トークンの有効期限に使う）", () => {
  expect(relativeTime("2026-07-26T12:59:00Z", now)).toBe("in 59 minutes");
});

test("1分未満は秒で表す", () => {
  expect(relativeTime("2026-07-26T11:59:30Z", now)).toBe("30 seconds ago");
});

test("解釈できない値はそのまま返す（表示のために落とさない）", () => {
  expect(relativeTime("not-a-date", now)).toBe("not-a-date");
});
