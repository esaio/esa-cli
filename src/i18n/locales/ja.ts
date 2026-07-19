import type { Resources } from "./en.js";

/** 日本語リソース。キーの過不足は Resources 型で検出される。 */
export const ja: Resources = {
  cli: {
    description: "esa.io の公式 CLI",
  },
  baseUrl: {
    invalid:
      "API のベース URL が不正です（ESA_API_BASE_URL を確認してください）: {{url}}",
    notHttp: "API のベース URL は http/https のみ対応しています: {{url}}",
    notAllowed:
      "許可されていない API のベース URL です（api.esa.io または localhost のみ）: {{url}}",
  },
  config: {
    desc: "esa-cli の設定を管理します (~/.config/esa-cli/config.json)",
    setDesc: "設定値を保存します",
    getDesc: "設定値を表示します",
    keyArg: "設定キー（{{keys}}）",
    valueArg: "値",
    unknownKey: "未知の設定キーです: {{key}}（対応: {{keys}}）",
    emptyValue: "{{key}} の値が空です。",
    setDone: "{{key}} を {{value}} に設定しました。",
    invalidLanguage: "{{key}} は次のいずれかを指定してください: {{langs}}",
  },
  auth: {
    desc: "esa.io と esa-cli を認証します",
    loginDesc: "OAuth（ブラウザ）で esa.io にログインします",
    loginSuccess: "認証に成功しました。トークンを {{backend}} に保存しました。",
    loginScope: "許可されたスコープ: {{scope}}",
    logoutDesc: "ログアウトして保存済みトークンを削除します",
    revokeFailed: "トークンの失効に失敗しました（削除は続行します）: {{error}}",
    logoutDone: "ログアウトしました。",
    tokenDeleted: "保存されたトークンを削除しました。",
    refreshDesc: "refresh token を使って OAuth アクセストークンを更新します",
    notLoggedIn:
      "OAuth でログインしていません。`esa auth login` を実行してください。",
    refreshDone: "トークンを更新しました（{{backend}}）。",
    statusDesc: "現在の認証状態を表示します",
  },
  user: {
    desc: "認証中のユーザーを表示します (GET /v1/user)",
  },
  team: {
    desc: "チームを操作します",
    listDesc: "所属しているチームの一覧を表示します (GET /v1/teams)",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
    roleOpt: "権限で絞り込み (member | owner)",
  },
  post: {
    desc: "記事を操作します",
    listDesc: "チームの記事一覧を表示します (GET /v1/teams/{team_name}/posts)",
    listTeamOpt:
      "対象チーム（省略時は ESA_TEAM / 既定チーム / 単一所属を使用）",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
    queryOpt: "検索クエリ",
    getDesc:
      "記事を1件取得します (GET /v1/teams/{team_name}/posts/{post_number})",
    numberArg: "記事番号",
    getTeamOpt: "対象チーム",
    idLabel: "記事ID",
  },
  parse: {
    notPositiveInt: "{{name}} は 1 以上の整数で指定してください: {{value}}",
  },
  oauth: {
    fetchingMetadata: "認可サーバーの情報を取得しています...",
    openingBrowser: "ブラウザで認可画面を開きます...",
    openUrlManually: "開かない場合は次の URL を開いてください:\n{{url}}\n",
    waiting: "ブラウザでの認可を待機しています...",
    tokenFetchFailed: "トークンの取得に失敗しました: {{error}}",
    tokenRefreshFailed: "トークンの更新に失敗しました: {{error}}",
    noRefreshToken: "refresh_token がありません。再ログインしてください。",
  },
  discovery: {
    notUrl:
      "認可サーバーのメタデータの {{field}} が URL ではありません: {{value}}",
    notHttps: "{{field}} は HTTPS である必要があります: {{value}}",
    missingField: "認可サーバーのメタデータに {{field}} がありません",
    fetchFailed:
      "認可サーバーのメタデータを取得できませんでした ({{url}}): {{error}}",
    pkceUnsupported:
      "認可サーバーが PKCE (S256) に対応していません: {{methods}}",
  },
  apiClient: {
    noAuth:
      "認証情報がありません。`esa auth login` でログインするか、ESA_ACCESS_TOKEN を設定してください。",
    connectionFailed: "esa API への接続に失敗しました: {{error}}",
  },
  apiResponse: {
    authFailed:
      "認証に失敗しました (401)。`esa auth login` で再ログインするか、ESA_ACCESS_TOKEN を確認してください。",
    requestFailed: "API リクエストに失敗しました ({{status}}): {{detail}}",
  },
  resolveTeam: {
    noTeams: "所属しているチームがありません。",
    multipleTeams:
      "複数のチームに所属しています。--team で指定するか、`esa config set default-team <name>` で既定を設定してください。\n所属チーム: {{teams}}",
  },
  tokenStore: {
    encryptedFileLabel: "暗号化ファイル (~/.config/esa-cli)",
    saveFailed: "トークンの保存に失敗しました ({{backend}}): {{error}}",
    parseWarning:
      "警告: トークンデータのパースに失敗しました ({{backend}}): {{error}}。`esa auth login` で再ログインしてください。",
  },
  credentialManager: {
    tooLarge:
      "データサイズ ({{size}} bytes) が Windows Credential Manager の上限 ({{max}} bytes) を超えています",
  },
  secretService: {
    locked:
      "キーリングがロックされています。「パスワードと鍵」(seahorse) でログインキーリングをアンロックするか、\n自動ログインを無効にしてログインし直してから、再度 `esa auth login` を実行してください。",
  },
  callback: {
    notFound: "見つかりません",
    successTitle: "認証が完了しました",
    successBody: "このタブを閉じてターミナルに戻ってください。",
    canceledBrowser: "認可がキャンセルされました: {{error}}",
    canceledError: "認可エラー: {{error}} {{description}}",
    stateMismatchBrowser: "state が一致しません",
    stateMismatchError: "state が一致しません（CSRF の可能性）",
    noCodeBrowser: "認可コードがありません",
    noCodeError: "認可コードが返されませんでした",
    timeout: "認証がタイムアウトしました（5分）",
  },
};
