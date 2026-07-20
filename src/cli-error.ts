/** 通常は簡潔なメッセージ、デバッグ時だけスタックトレースを返す。 */
export function formatCliError(error: unknown, debug = false): string {
  if (error instanceof Error) {
    if (debug && error.stack) return error.stack;
    return error.message;
  }
  return String(error);
}
