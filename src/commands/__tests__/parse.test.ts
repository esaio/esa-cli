import { expect, test } from "vitest";
import { positiveInt } from "../parse.js";

test("parses a positive integer", () => {
  expect(positiveInt("3", "--page")).toBe(3);
});

test("rejects a non-numeric value", () => {
  expect(() => positiveInt("abc", "--page")).toThrow(
    /--page.*positive integer/,
  );
});

test("rejects zero and negatives", () => {
  expect(() => positiveInt("0", "n")).toThrow(/positive integer/);
  expect(() => positiveInt("-1", "n")).toThrow(/positive integer/);
});

test("rejects a decimal", () => {
  expect(() => positiveInt("1.5", "n")).toThrow(/positive integer/);
});
