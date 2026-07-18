import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  encryptedDelete,
  encryptedLoad,
  encryptedSave,
} from "../encrypted-store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "esa-cli-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("save then load round-trips the data", async () => {
  const payload = JSON.stringify({ access_token: "secret-token" });
  await encryptedSave(payload, dir);
  expect(encryptedLoad(dir)).toBe(payload);
});

test("load returns null when nothing is stored", () => {
  expect(encryptedLoad(dir)).toBeNull();
});

test("delete removes the stored data", async () => {
  await encryptedSave("data", dir);
  await encryptedDelete(dir);
  expect(encryptedLoad(dir)).toBeNull();
});

test("stored file is not plaintext", async () => {
  const payload = "super-secret-value";
  await encryptedSave(payload, dir);
  const { readFileSync } = await import("node:fs");
  const raw = readFileSync(join(dir, "tokens.enc.json"), "utf-8");
  expect(raw).not.toContain(payload);
});
