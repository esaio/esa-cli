import { expect, test } from "vitest";
import { unwrap } from "../response.js";

test("returns data on success", () => {
  const data = { name: "esa" };
  expect(unwrap({ data, response: new Response(null, { status: 200 }) })).toBe(
    data,
  );
});

test("treats a 204 (no content) success as success, not an error", () => {
  expect(
    unwrap({ response: new Response(null, { status: 204 }) }),
  ).toBeUndefined();
});

test("throws a login hint on 401", () => {
  expect(() =>
    unwrap({ response: new Response(null, { status: 401 }) }),
  ).toThrow(/401.*esa auth login/s);
});

test("includes status and error detail on other failures", () => {
  expect(() =>
    unwrap({
      error: { message: "boom" },
      response: new Response(null, { status: 500 }),
    }),
  ).toThrow(/500.*boom/s);
});
