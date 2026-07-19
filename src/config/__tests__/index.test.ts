import { afterEach, beforeEach, expect, test, vi } from "vitest";

const ORIGINAL = process.env.ESA_API_BASE_URL;

/** config は import 時に process.env を読むため、都度読み込み直す。 */
async function loadGetOAuthConfig() {
  vi.resetModules();
  const { getOAuthConfig } = await import("../index.js");
  return getOAuthConfig;
}

beforeEach(() => {
  delete process.env.ESA_API_BASE_URL;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ESA_API_BASE_URL;
  else process.env.ESA_API_BASE_URL = ORIGINAL;
});

test("uses the default https base URL", async () => {
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(getOAuthConfig().apiBaseUrl).toBe("https://api.esa.io");
});

test("rejects a non-HTTPS external base URL (would leak tokens)", async () => {
  process.env.ESA_API_BASE_URL = "http://evil.example.com";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/not allowed/);
});

test("rejects an HTTPS third-party host (would still leak tokens over TLS)", async () => {
  process.env.ESA_API_BASE_URL = "https://evil.example.com";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/not allowed/);
});

test("rejects a userinfo-spoofed host (hostname is the real host)", async () => {
  process.env.ESA_API_BASE_URL = "https://api.esa.io@evil.com";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/not allowed/);
});

test("rejects http on api.esa.io (production must be HTTPS)", async () => {
  process.env.ESA_API_BASE_URL = "http://api.esa.io";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/not allowed/);
});

test("allows http on localhost for local development", async () => {
  process.env.ESA_API_BASE_URL = "http://localhost:3000";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).not.toThrow();
});

test("allows a *.localhost subdomain for local development", async () => {
  process.env.ESA_API_BASE_URL = "http://sub.localhost:3000";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).not.toThrow();
});

test("allows IPv6 loopback for local development", async () => {
  process.env.ESA_API_BASE_URL = "http://[::1]:3000";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).not.toThrow();
});

test("rejects a non-http(s) scheme even on localhost", async () => {
  process.env.ESA_API_BASE_URL = "ws://localhost:3000";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/http or https/);
});

test("rejects a malformed base URL", async () => {
  process.env.ESA_API_BASE_URL = "not a url";
  const getOAuthConfig = await loadGetOAuthConfig();
  expect(() => getOAuthConfig()).toThrow(/ESA_API_BASE_URL/);
});
