import { expect, test } from "vitest";
import { positiveInt } from "../parse.js";

test("parses a positive integer", () => {
  expect(positiveInt("3", "--page")).toBe(3);
});

test("rejects a non-numeric value", () => {
  expect(() => positiveInt("abc", "--page")).toThrow(/--page.*整数/);
});

test("rejects zero and negatives", () => {
  expect(() => positiveInt("0", "n")).toThrow(/整数/);
  expect(() => positiveInt("-1", "n")).toThrow(/整数/);
});

test("rejects a decimal", () => {
  expect(() => positiveInt("1.5", "n")).toThrow(/整数/);
});
