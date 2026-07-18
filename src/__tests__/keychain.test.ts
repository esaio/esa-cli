import { afterEach, beforeEach, expect, test, vi } from "vitest";

const execFileSyncMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));

const { keychainSave } = await import("../auth/keychain.js");

function commandFailure(stderr: string): Error {
  return Object.assign(
    new Error("Command failed: security add-generic-password ..."),
    {
      stderr: Buffer.from(stderr),
    },
  );
}

beforeEach(() => {
  execFileSyncMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("passes the secret through argv (documents the current behavior)", () => {
  keychainSave("token-json");

  const [, args] = execFileSyncMock.mock.calls[0] as [string, string[]];
  expect(args).toContain("token-json");
});

test("captures stderr so failures can be diagnosed", () => {
  // stdio の stderr を "ignore" にすると失敗理由が失われる。"pipe" であること。
  keychainSave("x");

  const [, , options] = execFileSyncMock.mock.calls[0] as [
    string,
    string[],
    { stdio: unknown[] },
  ];
  expect(options.stdio[2]).toBe("pipe");
});

test("surfaces the security stderr instead of a bare Command failed", () => {
  execFileSyncMock.mockImplementation(() => {
    throw commandFailure(
      "security: SecKeychainItemCreateFromContent: The specified item already exists in the keychain.",
    );
  });

  expect(() => keychainSave("x")).toThrow(/already exists in the keychain/);
});

test("falls back to the error message when stderr is empty", () => {
  execFileSyncMock.mockImplementation(() => {
    throw commandFailure("");
  });

  expect(() => keychainSave("x")).toThrow(/Command failed/);
});
