import { expect, test } from "vitest";
import { formatCliError } from "../cli-error.js";

test("returns only the message for ordinary CLI errors", () => {
  const error = new Error("bad input");

  expect(formatCliError(error)).toBe("bad input");
});

test("returns the stack when debug output is enabled", () => {
  const error = new Error("bad input");

  expect(formatCliError(error, true)).toBe(error.stack);
});

test("formats non-Error throws without losing their value", () => {
  expect(formatCliError("bad input")).toBe("bad input");
});
