import { getLanguage } from "../config/file-store.js";

export const SUPPORTED_LANGUAGES = ["en", "ja"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** 判定できないときの既定言語。 */
export const DEFAULT_LANGUAGE: Language = "en";

/**
 * `ja`・`ja_JP.UTF-8`・`en-US` などから先頭2文字を取り、対応言語なら返す。
 * 未対応・空・`C`/`POSIX` などは undefined（次の候補へ進める）。
 */
function normalize(raw: string | undefined | null): Language | undefined {
  if (!raw) return undefined;
  const lang = raw.trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as Language)
    : undefined;
}

export type LanguageSources = {
  /** 環境変数 ESA_LANG。 */
  esaLang?: string;
  /** 設定ファイルの language。 */
  configLanguage?: string;
  /** OS ロケール（LC_ALL / LC_MESSAGES / LANG）。 */
  posixLocale?: string;
};

/**
 * 優先順: ESA_LANG → 設定ファイル → OS ロケール → 既定。
 * 各段は未対応値なら次へフォールバックする。
 */
export function resolveLanguageFrom(sources: LanguageSources): Language {
  return (
    normalize(sources.esaLang) ??
    normalize(sources.configLanguage) ??
    normalize(sources.posixLocale) ??
    DEFAULT_LANGUAGE
  );
}

/**
 * 実際の環境変数と設定ファイルから使用言語を決める。
 * ESA_LANG で決まる場合は設定ファイルを読まない（遅延評価）。
 */
export function resolveLanguage(
  getConfigLanguage: () => string | undefined = getLanguage,
): Language {
  const fromEnv = normalize(process.env.ESA_LANG);
  if (fromEnv) return fromEnv;

  let fromConfig: Language | undefined;
  try {
    fromConfig = normalize(getConfigLanguage());
  } catch {
    // 設定ファイルの読み取り失敗で言語判定を止めない。
    fromConfig = undefined;
  }
  if (fromConfig) return fromConfig;

  return (
    normalize(
      process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG,
    ) ?? DEFAULT_LANGUAGE
  );
}
