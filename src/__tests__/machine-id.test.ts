import { afterEach, beforeEach, expect, test, vi } from "vitest";

const readFileSyncMock = vi.fn();
const execFileSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
}));
vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));
vi.mock("node:os", () => ({ hostname: () => "my-host" }));

const realPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

async function importGetMachineId() {
  const { getMachineId } = await import("../auth/machine-id.js");
  return getMachineId;
}

/** ファイルが存在しないときの readFileSync の振る舞い。 */
function notFound(): never {
  throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
}

beforeEach(() => {
  vi.resetModules();
  readFileSyncMock.mockReset();
  execFileSyncMock.mockReset();
  process.env.USER = "someone";
});

afterEach(() => {
  setPlatform(realPlatform);
});

test("uses /etc/machine-id on Linux", async () => {
  setPlatform("linux");
  readFileSyncMock.mockImplementation((path: string) =>
    path === "/etc/machine-id"
      ? "ecea54cd94e446989add71481f5b88a1\n"
      : notFound(),
  );

  expect(await (await importGetMachineId())()).toBe(
    "ecea54cd94e446989add71481f5b88a1",
  );
});

test("falls back to the dbus machine-id on Linux", async () => {
  setPlatform("linux");
  readFileSyncMock.mockImplementation((path: string) =>
    path === "/var/lib/dbus/machine-id" ? "dbus-id-value\n" : notFound(),
  );

  expect(await (await importGetMachineId())()).toBe("dbus-id-value");
});

test("falls back to user@hostname when Linux has no machine-id", async () => {
  setPlatform("linux");
  readFileSyncMock.mockImplementation(() => notFound());

  expect(await (await importGetMachineId())()).toBe("someone@my-host");
});

test("ignores an empty machine-id file", async () => {
  setPlatform("linux");
  readFileSyncMock.mockImplementation(() => "   \n");

  expect(await (await importGetMachineId())()).toBe("someone@my-host");
});

test("uses IOPlatformUUID on macOS", async () => {
  setPlatform("darwin");
  execFileSyncMock.mockReturnValue(
    '"IOPlatformUUID" = "11111111-2222-3333-4444-555555555555"',
  );

  expect(await (await importGetMachineId())()).toBe(
    "11111111-2222-3333-4444-555555555555",
  );
});

test("uses MachineGuid on Windows", async () => {
  setPlatform("win32");
  execFileSyncMock.mockReturnValue("    MachineGuid    REG_SZ    abcd-1234");

  expect(await (await importGetMachineId())()).toBe("abcd-1234");
});

test("caches the result", async () => {
  setPlatform("linux");
  readFileSyncMock.mockReturnValue("cached-id");
  const getMachineId = await importGetMachineId();

  getMachineId();
  getMachineId();

  expect(readFileSyncMock).toHaveBeenCalledTimes(1);
});
