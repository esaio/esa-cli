/** 端末表示で空の値に出す印。 */
const EMPTY_MARK = "-";

/**
 * 端末表示用に、空の値を印へ置き換える。値が無いのか表示が壊れたのかを
 * 読み手が区別できるようにする。パイプ出力は機械が読むので置き換えない。
 */
export function displayValue(value: string): string {
  return value.length > 0 ? value : EMPTY_MARK;
}

/**
 * 表の1セル・1項目に収まるよう、区切りになる制御文字を空白へ均す。
 * タブや改行がそのまま出ると、タブ区切りの列や行の区切りと区別できなくなり、
 * cut -fN のような列位置に依存する処理が壊れる。完全な値は --json で取れる。
 */
export function singleLine(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}
