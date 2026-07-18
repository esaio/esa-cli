export type ApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/**
 * openapi-fetch の結果からデータを取り出す。エラー時は状態に応じた
 * 分かりやすいメッセージにして投げる。
 */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.data !== undefined) return result.data;

  const { response, error } = result;
  if (response.status === 401) {
    throw new Error(
      "認証に失敗しました (401)。`esa auth login` で再ログインするか、ESA_ACCESS_TOKEN を確認してください。",
    );
  }

  const detail =
    error != null
      ? typeof error === "string"
        ? error
        : JSON.stringify(error)
      : response.statusText;
  throw new Error(
    `API リクエストに失敗しました (${response.status}): ${detail}`,
  );
}
