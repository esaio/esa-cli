import { t } from "../i18n/index.js";

export type ApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/**
 * openapi-fetch の結果からデータを取り出す。エラー時は状態に応じた
 * 分かりやすいメッセージにして投げる。
 * 204 など本文の無い成功もあるため、成否は response.ok で判定する。
 */
export function unwrap<T>(result: ApiResult<T>): T {
  const { response, error } = result;
  if (response.ok) return result.data as T;

  if (response.status === 401) {
    throw new Error(t("apiResponse.authFailed"));
  }

  const detail =
    error != null
      ? typeof error === "string"
        ? error
        : JSON.stringify(error)
      : response.statusText;
  throw new Error(
    t("apiResponse.requestFailed", { status: response.status, detail }),
  );
}
