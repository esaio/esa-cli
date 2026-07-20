import { expect, test } from "vitest";
import { evaluateCallback } from "../callback.js";

test("accepts an authorization code with the expected state", () => {
  const result = evaluateCallback(
    "/callback?state=expected-state&code=authorization-code",
    "expected-state",
  );

  expect(result.status).toBe(200);
  expect(result.contentType).toContain("text/html");
  expect(result.body).toContain("esa CLI");
  expect(result.code).toBe("authorization-code");
  expect(result.error).toBeUndefined();
});

test("rejects a callback whose state does not match", () => {
  const result = evaluateCallback(
    "/callback?state=wrong&code=authorization-code",
    "expected-state",
  );

  expect(result.status).toBe(400);
  expect(result.error?.message).toMatch(/state/i);
  expect(result.code).toBeUndefined();
});

test("reports an authorization error from the browser callback", () => {
  const result = evaluateCallback(
    "/callback?error=access_denied&error_description=cancelled",
    "expected-state",
  );

  expect(result.status).toBe(400);
  expect(result.error?.message).toMatch(/access_denied.*cancelled/);
});

test("rejects a callback without an authorization code", () => {
  const result = evaluateCallback(
    "/callback?state=expected-state",
    "expected-state",
  );

  expect(result.status).toBe(400);
  expect(result.error?.message).toMatch(/code/i);
});

test("returns 404 without settling the login for an unrelated path", () => {
  const result = evaluateCallback("/favicon.ico", "expected-state");

  expect(result.status).toBe(404);
  expect(result.code).toBeUndefined();
  expect(result.error).toBeUndefined();
});
