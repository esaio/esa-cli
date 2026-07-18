import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  getDefaultTeam,
  readFileConfig,
  setDefaultTeam,
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
  expect(getDefaultTeam(dir)).toBeUndefined();
});

test("set then get round-trips the default team", () => {
  setDefaultTeam("docs", dir);
  expect(getDefaultTeam(dir)).toBe("docs");
});

test("set overwrites a previous value", () => {
  setDefaultTeam("docs", dir);
  setDefaultTeam("dev", dir);
  expect(getDefaultTeam(dir)).toBe("dev");
});

test("treats a corrupted config file as empty", async () => {
  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), "{ not json");
  expect(readFileConfig(dir)).toEqual({});
});
