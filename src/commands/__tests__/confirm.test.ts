import { PassThrough } from "node:stream";
import { expect, test } from "vitest";
import { confirm } from "../confirm.js";

/** 回答文字列を1行（改行付き）流す入力ストリームと、出力を捨てる先を用意する。 */
function streamsWith(answer: string) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.resume(); // プロンプト出力を読み捨てる
  input.end(`${answer}\n`);
  return { input, output };
}

test.each([
  ["y", true],
  ["Y", true],
  ["yes", true],
  ["YES", true],
  ["  y  ", true],
  ["n", false],
  ["no", false],
  ["", false],
  ["yeah", false],
  ["nope", false],
])("confirm(%j) resolves to %s", async (answer, expected) => {
  await expect(confirm("Delete?", streamsWith(answer))).resolves.toBe(expected);
});

test("confirm resolves to false on EOF without an answer", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  output.resume();
  input.end(); // 回答せず即 EOF（Ctrl-D 相当）

  await expect(confirm("Delete?", { input, output })).resolves.toBe(false);
});
