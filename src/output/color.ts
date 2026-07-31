import { styleText } from "node:util";

type Format = Parameters<typeof styleText>[0];

/**
 * 装飾関数を作る。色を付けるかどうかは styleText が決める（端末でなければ、
 * また NO_COLOR / FORCE_COLOR の指定があればそれに従う）ので、ここで指定する
 * のは「どの出力先を見て判定させるか」だけ。
 *
 * stdout と stderr は別々にリダイレクトされうるため、実際の出力先と判定元を
 * 揃える。ずれると、色が付かない／リダイレクト先にエスケープが混ざる。
 */
function paint(
  format: Format,
  stream: NodeJS.WriteStream = process.stdout,
): (value: string) => string {
  return (value) => styleText(format, value, { stream });
}

export const bold = paint("bold");
export const dim = paint("dim");
export const green = paint("green");
export const yellow = paint("yellow");
export const red = paint("red");
export const cyan = paint("cyan");
export const underlineHeader = paint(["dim", "underline"]);

export const dimOnStderr = paint("dim", process.stderr);
export const greenOnStderr = paint("green", process.stderr);
export const yellowOnStderr = paint("yellow", process.stderr);
