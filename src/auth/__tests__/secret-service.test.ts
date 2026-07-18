import { afterEach, beforeEach, expect, test, vi } from "vitest";

const execFileSyncMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));

const { secretServiceSave } = await import("../secret-service.js");

/** execFileSync が投げるエラーの形（stderr を持つ）。 */
function commandFailure(stderr: string): Error {
  return Object.assign(new Error("Command failed: secret-tool store ..."), {
    stderr: Buffer.from(stderr),
  });
}

beforeEach(() => {
  execFileSyncMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("saves the secret through stdin, not as a command argument", () => {
  secretServiceSave("token-json");

  const [, , options] = execFileSyncMock.mock.calls[0] as [
    string,
    string[],
    { input: string },
  ];
  expect(options.input).toBe("token-json");

  const [, args] = execFileSyncMock.mock.calls[0] as [string, string[]];
  expect(args).not.toContain("token-json");
});

test("surfaces the secret-tool stderr instead of a bare Command failed", () => {
  // stderr を捨てていると "Command failed" しか出ず原因が分からない。
  execFileSyncMock.mockImplementation(() => {
    throw commandFailure(
      "secret-tool: Cannot create an item in a locked collection",
    );
  });

  expect(() => secretServiceSave("x")).toThrow(
    /Cannot create an item in a locked collection/,
  );
});

test("explains how to recover when the keyring is locked", () => {
  execFileSyncMock.mockImplementation(() => {
    throw commandFailure(
      "secret-tool: Cannot create an item in a locked collection",
    );
  });

  expect(() => secretServiceSave("x")).toThrow(/アンロック/);
  expect(() => secretServiceSave("x")).toThrow(/esa auth login/);
});

test("falls back to the error message when stderr is empty", () => {
  execFileSyncMock.mockImplementation(() => {
    throw commandFailure("");
  });

  expect(() => secretServiceSave("x")).toThrow(/Command failed/);
});
