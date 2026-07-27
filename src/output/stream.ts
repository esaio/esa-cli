const DEFAULT_WIDTH = 80;

/** stdout が端末かどうか。パイプ・リダイレクト時は false。 */
export function isStdoutTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * 端末の桁数。端末でない場合や取得できない場合は既定値を返す。
 * pty によっては 0 を返すことがあるため、正の数であることまで確かめる
 * （0 を信じると列幅の配分が全て 0 になり、何も表示されなくなる）。
 */
export function terminalWidth(): number {
  const columns = process.stdout.columns;
  return typeof columns === "number" && columns > 0 ? columns : DEFAULT_WIDTH;
}
