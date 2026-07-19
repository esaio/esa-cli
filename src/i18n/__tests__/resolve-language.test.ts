import { afterEach, beforeEach, expect, test } from "vitest";
import {
  DEFAULT_LANGUAGE,
  resolveLanguage,
  resolveLanguageFrom,
} from "../resolve-language.js";

// resolveLanguageFrom は純粋関数（優先順と正規化）を検証する。

test("ESA_LANG が最優先", () => {
  expect(
    resolveLanguageFrom({
      esaLang: "ja",
      configLanguage: "en",
      posixLocale: "en_US.UTF-8",
    }),
  ).toBe("ja");
});

test("ESA_LANG が無ければ設定ファイル", () => {
  expect(
    resolveLanguageFrom({ configLanguage: "ja", posixLocale: "en_US" }),
  ).toBe("ja");
});

test("ESA_LANG も設定も無ければ OS ロケール", () => {
  expect(resolveLanguageFrom({ posixLocale: "ja_JP.UTF-8" })).toBe("ja");
});

test("どれも無ければ既定言語", () => {
  expect(resolveLanguageFrom({})).toBe(DEFAULT_LANGUAGE);
  expect(DEFAULT_LANGUAGE).toBe("en");
});

test("大文字・地域コード・エンコーディングを正規化する", () => {
  expect(resolveLanguageFrom({ esaLang: "JA" })).toBe("ja");
  expect(resolveLanguageFrom({ esaLang: "en-US" })).toBe("en");
  expect(resolveLanguageFrom({ posixLocale: "ja_JP.UTF-8" })).toBe("ja");
});

test("未対応の値はスキップして次の候補へ進む", () => {
  expect(resolveLanguageFrom({ esaLang: "fr", configLanguage: "ja" })).toBe(
    "ja",
  );
});

test("C / POSIX ロケールは未対応として既定へ落ちる", () => {
  expect(resolveLanguageFrom({ posixLocale: "C" })).toBe("en");
  expect(resolveLanguageFrom({ posixLocale: "POSIX" })).toBe("en");
});

test("空白のみの値は未指定として扱う", () => {
  expect(resolveLanguageFrom({ esaLang: "   ", configLanguage: "ja" })).toBe(
    "ja",
  );
});

// resolveLanguage は実際の process.env と注入した設定取得関数を使う。
const SNAPSHOT = {
  ESA_LANG: process.env.ESA_LANG,
  LANG: process.env.LANG,
  LC_ALL: process.env.LC_ALL,
  LC_MESSAGES: process.env.LC_MESSAGES,
};

beforeEach(() => {
  for (const key of Object.keys(SNAPSHOT)) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(SNAPSHOT)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("ESA_LANG が設定より優先される", () => {
  process.env.ESA_LANG = "ja";
  expect(resolveLanguage(() => "en")).toBe("ja");
});

test("ESA_LANG が無ければ設定ファイルの language を使う", () => {
  expect(resolveLanguage(() => "ja")).toBe("ja");
});

test("ESA_LANG で決まる場合は設定ファイルを読まない", () => {
  process.env.ESA_LANG = "en";
  let read = false;
  resolveLanguage(() => {
    read = true;
    return "ja";
  });
  expect(read).toBe(false);
});

test("設定ファイルの読み取りエラーで落ちない", () => {
  process.env.LANG = "ja_JP.UTF-8";
  expect(
    resolveLanguage(() => {
      throw new Error("boom");
    }),
  ).toBe("ja");
});
