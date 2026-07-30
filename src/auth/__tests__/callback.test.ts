import { expect, test } from "vitest";
import { evaluateCallback } from "../callback.js";

test("accepts an authorization code with the expected state", () => {
  const result = evaluateCallback(
    "/callback?state=expected-state&code=authorization-code",
    "expected-state",
  );

  expect(result.status).toBe(302);
  expect(result.headers.Location).toBe("https://api.esa.io/oauth/cli/success");
  expect(result.headers["Referrer-Policy"]).toBe("no-referrer");
  expect(result.code).toBe("authorization-code");
  expect(result.error).toBeUndefined();
});

test("does not pass the authorization code on to the success page", () => {
  const result = evaluateCallback(
    "/callback?state=expected-state&code=authorization-code",
    "expected-state",
  );

  expect(result.headers.Location).not.toContain("authorization-code");
  expect(result.headers.Location).not.toContain("expected-state");
});

test("rejects a callback whose state does not match", () => {
  const result = evaluateCallback(
    "/callback?state=wrong&code=authorization-code",
    "expected-state",
  );

  expect(result.status).toBe(302);
  expect(result.headers.Location).toBe("https://api.esa.io/oauth/cli/failure");
  expect(result.error?.message).toMatch(/state/i);
  expect(result.code).toBeUndefined();
});

test("reports an authorization error from the browser callback", () => {
  const result = evaluateCallback(
    "/callback?error=access_denied&error_description=cancelled",
    "expected-state",
  );

  expect(result.status).toBe(302);
  expect(result.headers.Location).toBe("https://api.esa.io/oauth/cli/failure");
  expect(result.error?.message).toMatch(/access_denied.*cancelled/);
});

test("does not forward the authorization error into the failure page", () => {
  const result = evaluateCallback(
    "/callback?error=access_denied&error_description=cancelled",
    "expected-state",
  );

  expect(result.headers.Location).not.toContain("access_denied");
  expect(result.headers.Location).not.toContain("cancelled");
});

test("rejects a callback without an authorization code", () => {
  const result = evaluateCallback(
    "/callback?state=expected-state",
    "expected-state",
  );

  expect(result.status).toBe(302);
  expect(result.headers.Location).toBe("https://api.esa.io/oauth/cli/failure");
  expect(result.error?.message).toMatch(/code/i);
});

test("returns 404 without settling the login for an unrelated path", () => {
  const result = evaluateCallback("/favicon.ico", "expected-state");

  expect(result.status).toBe(404);
  expect(result.headers.Location).toBeUndefined();
  expect(result.code).toBeUndefined();
  expect(result.error).toBeUndefined();
});
