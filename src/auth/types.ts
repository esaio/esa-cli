/**
 * OS 資格情報ストア（またはフォールバックの暗号化ファイル）に保存する
 * トークン一式。JSON 文字列としてシリアライズして保存する。
 */
export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope?: string;
  /** アクセストークンの有効期限（UNIX 秒）。付与されない場合は undefined。 */
  expires_at?: number;
  client_id: string;
};
