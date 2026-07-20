/** 呼び出し元の AbortSignal を保ったまま、リクエスト全体のタイムアウトを加える。 */
export function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (input instanceof Request) signals.push(input.signal);
  if (init?.signal) signals.push(init.signal);

  return globalThis.fetch(input, {
    ...init,
    signal: AbortSignal.any(signals),
  });
}
