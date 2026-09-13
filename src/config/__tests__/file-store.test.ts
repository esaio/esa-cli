import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  getConfigValue,
  readFileConfig,
  setConfigValue,
  unsetConfigValue,
} from "../file-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "esa-cli-cfg-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("returns an empty config when the file is absent", () => {
  expect(readFileConfig(dir)).toEqual({});
  expect(getConfigValue("default_team", dir)).toBeUndefined();
});

test("set then get round-trips the default team", () => {
  setConfigValue("default_team", "docs", dir);
  expect(getConfigValue("default_team", dir)).toBe("docs");
});

test("set overwrites a previous value", () => {
  setConfigValue("default_team", "docs", dir);
  setConfigValue("default_team", "dev", dir);
  expect(getConfigValue("default_team", dir)).toBe("dev");
});

test("treats a corrupted config file as empty", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), "{ not json");
  expect(readFileConfig(dir)).toEqual({});
});

test("propagates a non-ENOENT read error instead of swallowing it", async () => {
  const { mkdir } = await import("node:fs/promises");
  // config.json をディレクトリにすると readFileSync が EISDIR で失敗する。
  await mkdir(join(dir, "config.json"), { recursive: true });
  expect(() => readFileConfig(dir)).toThrow();
});

test.each(["null", '"a string"', "[1, 2]", "42"])(
  "treats valid-but-non-object JSON (%s) as empty",
  async (content) => {
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "config.json"), content);
    expect(readFileConfig(dir)).toEqual({});
    expect(getConfigValue("default_team", dir)).toBeUndefined();
  },
);

test("ignores a non-string default_team", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), '{"default_team": 123}');
  expect(getConfigValue("default_team", dir)).toBeUndefined();
});

test("set then get round-trips the language", () => {
  setConfigValue("language", "ja", dir);
  expect(getConfigValue("language", dir)).toBe("ja");
});

test("language and default_team coexist without clobbering", () => {
  setConfigValue("default_team", "docs", dir);
  setConfigValue("language", "ja", dir);
  expect(getConfigValue("default_team", dir)).toBe("docs");
  expect(getConfigValue("language", dir)).toBe("ja");
});

test("ignores a non-string language", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), '{"language": 123}');
  expect(getConfigValue("language", dir)).toBeUndefined();
});

test("unset removes the default team and keeps the language", () => {
  setConfigValue("default_team", "docs", dir);
  setConfigValue("language", "ja", dir);
  unsetConfigValue("default_team", dir);
  expect(getConfigValue("default_team", dir)).toBeUndefined();
  expect(getConfigValue("language", dir)).toBe("ja");
  // キーごと消えていて、undefined で残っていないこと。
  expect(readFileConfig(dir)).toEqual({ language: "ja" });
});

test("unset removes the language and keeps the default team", () => {
  setConfigValue("default_team", "docs", dir);
  setConfigValue("language", "ja", dir);
  unsetConfigValue("language", dir);
  expect(getConfigValue("language", dir)).toBeUndefined();
  expect(getConfigValue("default_team", dir)).toBe("docs");
});

test("unset on an absent file leaves an empty config", () => {
  unsetConfigValue("default_team", dir);
  expect(readFileConfig(dir)).toEqual({});
});
