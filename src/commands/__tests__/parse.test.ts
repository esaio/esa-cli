import { expect, test } from "vitest";
import { nonEmpty, parseTimeoutMs, positiveInt } from "../parse.js";

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

test("parseTimeoutMs converts seconds to milliseconds", () => {
  expect(parseTimeoutMs("30")).toBe(30000);
});

test("parseTimeoutMs returns undefined when unset", () => {
  expect(parseTimeoutMs(undefined)).toBeUndefined();
});

test("parseTimeoutMs rejects a non-positive-integer value", () => {
  expect(() => parseTimeoutMs("abc")).toThrow(/--timeout.*positive integer/);
  expect(() => parseTimeoutMs("0")).toThrow(/positive integer/);
});

test("nonEmpty strips surrounding whitespace", () => {
  expect(nonEmpty("  docs  ", "--team")).toBe("docs");
});

test("nonEmpty rejects an empty value", () => {
  expect(() => nonEmpty("", "--child-team")).toThrow(
    /--child-team must not be empty/,
  );
});

test("nonEmpty rejects a whitespace-only value", () => {
  expect(() => nonEmpty("   ", "--child-team")).toThrow(/must not be empty/);
});
