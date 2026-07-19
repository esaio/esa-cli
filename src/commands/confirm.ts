import { createInterface } from "node:readline";

/**
 * y/N の確認を取る。プロンプトは stderr、入力は stdin から読む。
 * "y" / "yes"（大文字小文字問わず）のみ true。それ以外は false（既定は No）。
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`${message} `, resolve);
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
