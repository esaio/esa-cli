import i18next from "i18next";
import { en } from "./locales/en.js";
import { ja } from "./locales/ja.js";
import { DEFAULT_LANGUAGE, resolveLanguage } from "./resolve-language.js";

// インライン resource のみ・非同期 backend なしのため initAsync:false で
// 同期初期化する（init 直後から t() が使える）。補間値はブラウザの HTML には
// 静的な文言しか埋め込まず（callback.ts）、ユーザー入力は text/plain で返すため、
// HTML エスケープは無効化する（CLI 出力に実体参照が混ざらないように）。
i18next.init({
  lng: resolveLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  interpolation: { escapeValue: false },
  initAsync: false,
});

/** 翻訳関数。i18next インスタンスに束縛済み。 */
export const t = i18next.t.bind(i18next) as typeof i18next.t;

/** 現在の言語コード（"en" | "ja"）。 */
export function currentLanguage(): string {
  return i18next.language;
}

/** @internal テスト用: i18next インスタンス（getFixedT で言語別検証に使う）。 */
export const i18n = i18next;
