import { afterEach, expect, test, vi } from "vitest";
import { fetchWithTimeout } from "../fetch.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("adds a timeout signal to fetch", async () => {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await fetchWithTimeout("https://api.esa.io/v1/user", undefined, 10_000);

  expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
});

test("preserves and combines a caller-provided abort signal", async () => {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();

  await fetchWithTimeout(
    "https://api.esa.io/v1/user",
    { signal: controller.signal },
    10_000,
  );
  const combined = fetchMock.mock.calls[0][1]?.signal;
  controller.abort();

  expect(combined?.aborted).toBe(true);
});
