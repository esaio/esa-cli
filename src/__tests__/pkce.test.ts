import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { generatePkce, generateState } from "../auth/pkce.js";

const BASE64URL = /^[A-Za-z0-9_-]+$/;

test("generatePkce produces a base64url verifier and matching S256 challenge", () => {
  const { verifier, challenge } = generatePkce();

  expect(verifier).toMatch(BASE64URL);
  expect(challenge).toMatch(BASE64URL);

  const expected = createHash("sha256").update(verifier).digest("base64url");
  expect(challenge).toBe(expected);
});

test("generatePkce is randomized per call", () => {
  expect(generatePkce().verifier).not.toBe(generatePkce().verifier);
});

test("generateState returns a base64url string", () => {
  expect(generateState()).toMatch(BASE64URL);
});
