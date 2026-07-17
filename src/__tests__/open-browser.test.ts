import { afterEach, expect, test, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

const { openBrowser } = await import("../auth/open-browser.js");

// 実際の認可 URL と同じく & 区切りのクエリを持つもの。
const AUTH_URL =
  "https://api.esa.io/oauth/authorize?response_type=code&client_id=abc123&redirect_uri=http%3A%2F%2F127.0.0.1%3A51234%2Fcallback&scope=read%3Apost+write%3Apost&code_challenge=xyz&state=s1";

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

afterEach(() => {
  setPlatform(realPlatform);
  execFileMock.mockReset();
});

function callArgs(): [string, string[]] {
  const [command, args] = execFileMock.mock.calls[0] as [string, string[]];
  return [command, args];
}

test("passes the URL to open on macOS", () => {
  setPlatform("darwin");

  openBrowser(AUTH_URL);

  expect(callArgs()).toEqual(["open", [AUTH_URL]]);
});

test("passes the URL to xdg-open on Linux", () => {
  setPlatform("linux");

  openBrowser(AUTH_URL);

  expect(callArgs()).toEqual(["xdg-open", [AUTH_URL]]);
});

test("keeps the whole URL on Windows, including everything after the first &", () => {
  // cmd の `start` に URL を渡すと & 以降が切り落とされ、client_id が
  // 届かないまま認可画面に飛ぶ。二度と cmd 経由に戻さないための回帰テスト。
  setPlatform("win32");

  openBrowser(AUTH_URL);

  const [command, args] = callArgs();
  expect(command).toBe("powershell.exe");
  expect(command).not.toBe("cmd");

  const encoded = args[args.indexOf("-EncodedCommand") + 1];
  const script = Buffer.from(encoded, "base64").toString("utf16le");

  expect(script).toContain(AUTH_URL);
  expect(script).toContain("client_id=abc123");
  expect(script).toContain("state=s1");
});

test("escapes single quotes so they cannot break out of the PowerShell string", () => {
  setPlatform("win32");

  openBrowser("https://example.com/?a=1'+injected");

  const [, args] = callArgs();
  const encoded = args[args.indexOf("-EncodedCommand") + 1];
  const script = Buffer.from(encoded, "base64").toString("utf16le");

  expect(script).toBe("Start-Process 'https://example.com/?a=1''+injected'");
});
