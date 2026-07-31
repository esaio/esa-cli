import type { components } from "../generated/api-types.js";
import { t } from "../i18n/index.js";

/**
 * ページ情報。esa の一覧応答はすべて共通の Pagination スキーマを持つので、
 * 一覧コマンドは応答をそのまま渡せる。
 */
export type PageInfo = components["schemas"]["Pagination"];

/**
 * 総ページ数。esa は総ページ数を返さないので総数と1ページあたりの件数から出す。
 * どちらかが欠けていれば求めようがないので undefined を返す。
 */
function totalPages(info: PageInfo): number | undefined {
  const { total_count: total, per_page: perPage } = info;
  if (total === undefined || perPage === undefined || perPage <= 0) {
    return undefined;
  }
  // 0 件でも 1 ページ目は存在するので、下限を 1 にする。
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * 一覧の末尾に出す「30 / 6654 件 (page 2/222)」の1行を組み立てる。
 * 総数が分からない応答では何も言えないので undefined を返す。
 *
 * 次ページのコマンド例は出さない。`page 2/222` の時点で続きの有無も残りの量も
 * 分かるうえ、`--page` という摘みの存在も示せるため。機械向けには `--json` が
 * `next_page` をそのまま返す。
 */
export function formatPageSummary(
  info: PageInfo,
  shown: number,
): string | undefined {
  const total = info.total_count;
  if (total === undefined) return undefined;

  const page = info.page;
  if (page === undefined) return t("output.pageSummary", { shown, total });

  const pages = totalPages(info);
  return pages === undefined
    ? t("output.pageSummaryPage", { shown, total, page })
    : t("output.pageSummaryPages", { shown, total, page, pages });
}
