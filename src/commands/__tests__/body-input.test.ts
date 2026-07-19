import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { readBody, requireBody } from "../body-input.js";

vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));

const mockedReadFileSync = vi.mocked(readFileSync);

afterEach(() => {
  vi.restoreAllMocks();
});

test("readBody returns the inline --body value", () => {
  expect(readBody({ body: "hello" })).toBe("hello");
  expect(mockedReadFileSync).not.toHaveBeenCalled();
});

test("readBody reads --body-file from the given path", () => {
  mockedReadFileSync.mockReturnValue("from file");

  expect(readBody({ bodyFile: "note.md" })).toBe("from file");
  expect(mockedReadFileSync).toHaveBeenCalledWith("note.md", "utf-8");
});

test("readBody reads stdin (fd 0) when --body-file is -", () => {
  mockedReadFileSync.mockReturnValue("from stdin");

  expect(readBody({ bodyFile: "-" })).toBe("from stdin");
  expect(mockedReadFileSync).toHaveBeenCalledWith(0, "utf-8");
});

test("readBody returns undefined when neither is set", () => {
  expect(readBody({})).toBeUndefined();
});

test("readBody throws when both --body and --body-file are given", () => {
  expect(() => readBody({ body: "x", bodyFile: "y.md" })).toThrow(
    /--body and --body-file/,
  );
});

test("requireBody throws when no body is provided", () => {
  expect(() => requireBody({})).toThrow(/Body is required/);
});

test("requireBody returns the body when provided", () => {
  expect(requireBody({ body: "content" })).toBe("content");
});
