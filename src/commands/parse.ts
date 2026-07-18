/** 1 以上の整数として解釈する。CLI オプションや引数の共通バリデーション。 */
export function positiveInt(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${name} は 1 以上の整数で指定してください: ${value}`);
  }
  return n;
}
