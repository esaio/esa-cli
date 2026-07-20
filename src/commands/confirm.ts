import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

type ConfirmStreams = {
  input?: Readable;
  output?: Writable;
};

/**
 * y/N の確認を取る。プロンプトは stderr、入力は stdin から読む。
 * "y" / "yes"（大文字小文字問わず）のみ true。それ以外は false（既定は No）。
 */
export async function confirm(
  message: string,
  streams: ConfirmStreams = {},
): Promise<boolean> {
  const input = streams.input ?? process.stdin;
  const output = streams.output ?? process.stderr;
  const rl = createInterface({ input, output });
  try {
    const answer = await new Promise<string>((resolve) => {
      // EOF（Ctrl-D）では question の callback が発火しないので、close で
      // 既定の No（空回答）に解決してハングを防ぐ。
      rl.on("close", () => resolve(""));
      rl.question(`${message} `, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
