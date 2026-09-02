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

/**
 * 空では意味を成さない値を検証し、前後の空白を除いて返す。空白だけの値も空と
 * みなす。素通しすると空のまま URL やリクエストや設定ファイルへ渡り、離れた
 * ところの失敗として現れるので、どの入力が悪いのかを名前付きで手前から返す。
 */
export function nonEmpty(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(t("parse.empty", { name }));
  return trimmed;
}
