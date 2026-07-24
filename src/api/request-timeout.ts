// --timeout グローバルオプションで指定された API リクエストのタイムアウト（ミリ秒）。
// アクション実行前に一度だけ設定し、createEsaClient が参照する。未設定ならタイムアウトなし。
let requestTimeoutMs: number | undefined;

export function setRequestTimeoutMs(ms: number | undefined): void {
  requestTimeoutMs = ms;
}

export function getRequestTimeoutMs(): number | undefined {
  return requestTimeoutMs;
}
