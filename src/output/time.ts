import { currentLanguage } from "../i18n/index.js";
import { isStdoutTTY } from "./stream.js";

/** 大きい単位から順に評価する。閾値は「その単位1つ分の秒数」。 */
const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

/**
 * 相対時刻の表示（例: "2 hours ago" / "2 時間前"、未来なら "in 3 minutes"）。
 * 端末向けの表示専用で、パイプ時は元の ISO 8601 をそのまま出す
 * （機械側で解釈できるように）。表記は Intl 任せなので i18n に追従する。
 */
export function relativeTime(value: string, now: Date = new Date()): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;

  const elapsed = Math.round((now.getTime() - at.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(currentLanguage(), {
    numeric: "auto",
  });

  for (const [unit, seconds] of UNITS) {
    if (Math.abs(elapsed) >= seconds || unit === "second") {
      return format.format(-Math.trunc(elapsed / seconds), unit);
    }
  }
  return value;
}

/**
 * 一覧に出す日時。端末では読みやすさを優先して相対表示にし、パイプ時は
 * 機械が解釈できるよう ISO 8601 のまま渡す。
 */
export function displayTime(value: string): string {
  return isStdoutTTY() ? relativeTime(value) : value;
}
