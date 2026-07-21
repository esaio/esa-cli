/**
 * loopback ホストか判定する。RFC 6761 で localhost とそのサブドメインは loopback に
 * 解決される。IPv6 ループバックの hostname は WHATWG URL では "[::1]"（角括弧付き）。
 */
export function isLoopbackHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]"
  );
}
