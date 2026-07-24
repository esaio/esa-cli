import { t } from "../i18n/index.js";

/** 1 以上の整数として解釈する。CLI オプションや引数の共通バリデーション。 */
export function positiveInt(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(t("parse.notPositiveInt", { name, value }));
  }
  return n;
}

/**
 * --timeout（正の整数秒）を検証してミリ秒に変換する。未指定なら undefined。
 */
export function parseTimeoutMs(raw: string | undefined): number | undefined {
  return raw === undefined ? undefined : positiveInt(raw, "--timeout") * 1000;
}

/**
 * サーバー所有の列挙値をそのまま渡す。生成型より先にAPIへ値が追加されてもCLIが
 * 黙って値を捨てないよう、妥当性の最終判断はサーバーに委ねる。
 */
export function serverEnum<T extends string>(
  value: string | undefined,
): T | undefined {
  return value as T | undefined;
}
