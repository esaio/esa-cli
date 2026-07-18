import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { clearMetadataCache, fetchMetadata } from "../discovery.js";

const BASE_URL = "https://api.esa.io";

/** esa が実際に返しているメタデータ。 */
const ESA_METADATA = {
  issuer: "https://esa.io/",
  authorization_endpoint: "https://api.esa.io/oauth/authorize",
  token_endpoint: "https://api.esa.io/oauth/token",
  registration_endpoint: "https://api.esa.io/oauth/dcr",
  revocation_endpoint: "https://api.esa.io/oauth/revoke",
  response_types_supported: ["code"],
  code_challenge_methods_supported: ["S256"],
};

function mockDiscovery(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  clearMetadataCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("fetches metadata from the well-known endpoint of the API base URL", async () => {
  const fetchMock = mockDiscovery(ESA_METADATA);

  const metadata = await fetchMetadata(BASE_URL);

  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.esa.io/.well-known/oauth-authorization-server",
    expect.anything(),
  );
  expect(metadata.authorization_endpoint).toBe(
    "https://api.esa.io/oauth/authorize",
  );
  expect(metadata.token_endpoint).toBe("https://api.esa.io/oauth/token");
  expect(metadata.revocation_endpoint).toBe("https://api.esa.io/oauth/revoke");
});

test("caches metadata so repeated calls hit the network once", async () => {
  const fetchMock = mockDiscovery(ESA_METADATA);

  await fetchMetadata(BASE_URL);
  await fetchMetadata(BASE_URL);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("throws when the endpoint returns a non-OK status", async () => {
  mockDiscovery("not found", 404);

  await expect(fetchMetadata(BASE_URL)).rejects.toThrow(/404/);
});

test("throws when a required endpoint is missing", async () => {
  mockDiscovery({ issuer: "https://esa.io/" });

  await expect(fetchMetadata(BASE_URL)).rejects.toThrow(
    /authorization_endpoint/,
  );
});

test("rejects a non-HTTPS endpoint when the base URL is HTTPS", async () => {
  mockDiscovery({
    ...ESA_METADATA,
    token_endpoint: "http://evil.example.com/oauth/token",
  });

  await expect(fetchMetadata(BASE_URL)).rejects.toThrow(/HTTPS/);
});

test("allows HTTP endpoints when the base URL itself is HTTP (local development)", async () => {
  mockDiscovery({
    issuer: "http://localhost:3000/",
    authorization_endpoint: "http://localhost:3000/oauth/authorize",
    token_endpoint: "http://localhost:3000/oauth/token",
    code_challenge_methods_supported: ["S256"],
  });

  const metadata = await fetchMetadata("http://localhost:3000");

  expect(metadata.token_endpoint).toBe("http://localhost:3000/oauth/token");
});

test("throws when the server does not support PKCE S256", async () => {
  mockDiscovery({
    ...ESA_METADATA,
    code_challenge_methods_supported: ["plain"],
  });

  await expect(fetchMetadata(BASE_URL)).rejects.toThrow(/PKCE/);
});

test("rejects a non-HTTPS revocation_endpoint (would leak tokens on logout)", async () => {
  mockDiscovery({
    ...ESA_METADATA,
    revocation_endpoint: "http://attacker.example.com/revoke",
  });

  await expect(fetchMetadata(BASE_URL)).rejects.toThrow(/HTTPS/);
});

test("treats a missing revocation_endpoint as undefined, not an error", async () => {
  const { revocation_endpoint, ...withoutRevoke } = ESA_METADATA;
  void revocation_endpoint;
  mockDiscovery(withoutRevoke);

  const metadata = await fetchMetadata(BASE_URL);

  expect(metadata.revocation_endpoint).toBeUndefined();
});

test("throws a clear error when the base URL is invalid, without fetching", async () => {
  const fetchMock = mockDiscovery(ESA_METADATA);

  await expect(fetchMetadata("api.esa.io")).rejects.toThrow(/ESA_API_BASE_URL/);
  expect(fetchMock).not.toHaveBeenCalled();
});
