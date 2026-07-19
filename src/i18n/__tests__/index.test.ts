import { expect, test } from "vitest";
import { i18n, t } from "../index.js";

// vitest は ESA_LANG=en で動くため、既定の t() は英語を返す。
test("default t() returns English (ESA_LANG=en in test env)", () => {
  expect(t("resolveTeam.noTeams")).toBe("You do not belong to any team.");
});

test("getFixedT resolves each language independently", () => {
  const en = i18n.getFixedT("en");
  const ja = i18n.getFixedT("ja");
  expect(en("callback.successTitle")).toBe("Authentication complete");
  expect(ja("callback.successTitle")).toBe("認証が完了しました");
});

test("interpolation fills placeholders in both languages", () => {
  const en = i18n.getFixedT("en");
  const ja = i18n.getFixedT("ja");
  expect(en("parse.notPositiveInt", { name: "--page", value: "x" })).toBe(
    "--page must be a positive integer (>= 1): x",
  );
  expect(ja("parse.notPositiveInt", { name: "--page", value: "x" })).toBe(
    "--page は 1 以上の整数で指定してください: x",
  );
});

test("interpolation is not HTML-escaped (CLI output)", () => {
  const en = i18n.getFixedT("en");
  // <name> のような山括弧がエスケープされないこと。
  expect(en("resolveTeam.multipleTeams", { teams: "a, b" })).toContain(
    "<name>",
  );
});
