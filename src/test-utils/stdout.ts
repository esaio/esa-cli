import { vi } from "vitest";

/**
 * @internal テスト用。一覧の既定出力は process.stdout.write に直接書くため、
 * console.log の spy では捕まえられない。
 *
 * write(chunk, cb) と write(chunk, encoding, cb) の両方を受け、完了通知を
 * 呼び返す。落とすと、書き込みの完了を待つ呼び出し側がそこで止まる。
 */
export function captureStdout(): { output: () => string } {
  const chunks: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation(
    (
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) => {
      chunks.push(String(chunk));
      const done = typeof encoding === "function" ? encoding : callback;
      done?.();
      return true;
    },
  );
  return { output: () => chunks.join("") };
}
