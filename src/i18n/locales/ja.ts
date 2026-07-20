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
    statsDesc: "チームの統計情報を表示します (GET /v1/teams/{team_name}/stats)",
    teamOpt: "対象チーム",
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
    searchDesc: "チームの記事を検索します (GET /v1/teams/{team_name}/posts)",
    searchQueryArg: "検索クエリ",
    createDesc: "記事を作成します (POST /v1/teams/{team_name}/posts)",
    createNameArg:
      '記事名（タイトル）。名前に "/" を含めるとカテゴリになります',
    updateDesc:
      "記事を更新します (PATCH /v1/teams/{team_name}/posts/{post_number})",
    appendDesc: "記事本文の末尾に Markdown を追記します",
    prependDesc: "記事本文の先頭に Markdown を追記します",
    archiveDesc: "記事を Archived/ カテゴリに移してアーカイブします",
    backlinksDesc:
      "この記事を参照している記事の一覧を表示します (GET /v1/teams/{team_name}/posts/{post_number}/backlinks)",
    deleteDesc:
      "記事を削除します (DELETE /v1/teams/{team_name}/posts/{post_number})",
    nameOpt: "記事名（タイトル）",
    categoryOpt: "カテゴリのパス（例: dev/docs）",
    tagsOpt: "カンマ区切りのタグ（例: a,b,c）",
    bodyOpt: "本文（Markdown）",
    bodyFileOpt: "本文をファイルから読み込みます（- で標準入力）",
    wipOpt: "WIP（作業中）にします",
    shipOpt: "Ship します（WIP を解除します）",
    messageOpt: "変更メッセージ",
    yesOpt: "確認プロンプトをスキップします",
    bodyConflict: "--body と --body-file は同時に指定できません。",
    bodyRequired: "本文を指定してください（--body または --body-file）。",
    wipConflict: "--wip と --ship は同時に指定できません。",
    emptyName: "記事名が空です。",
    alreadyArchived:
      "記事 #{{number}} はすでにアーカイブ済みです（{{category}}）。",
    deleteConfirm: "記事 #{{number}}「{{name}}」を削除しますか？ [y/N]:",
    deleteConfirmRequired:
      "削除には確認が必要です。非対話環境では --yes を指定してください。",
    deleteCanceled: "削除をキャンセルしました。",
    deleteDone: "記事 #{{number}} を削除しました。",
  },
  comment: {
    desc: "コメントを操作します",
    listDesc:
      "チームのコメント一覧を表示します (GET /v1/teams/{team_name}/comments)。--post で記事に絞り込みます",
    listPostOpt: "チーム全体ではなく、指定した記事番号のコメントを表示します",
    getDesc:
      "コメントを1件取得します (GET /v1/teams/{team_name}/comments/{comment_id})",
    createDesc:
      "記事にコメントを作成します (POST /v1/teams/{team_name}/posts/{post_number}/comments)",
    updateDesc:
      "コメントを更新します (PATCH /v1/teams/{team_name}/comments/{comment_id})",
    deleteDesc:
      "コメントを削除します (DELETE /v1/teams/{team_name}/comments/{comment_id})",
    idArg: "コメントID",
    createPostArg: "コメントを付ける記事番号",
    idLabel: "コメントID",
    teamOpt: "対象チーム",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
    stargazersOpt: "レスポンスにスターしたメンバーを含めます",
    bodyOpt: "本文（Markdown）",
    bodyFileOpt: "本文をファイルから読み込みます（- で標準入力）",
    userOpt:
      "指定した screen_name のユーザーとして投稿します（owner 権限が必要）",
    yesOpt: "確認プロンプトをスキップします",
    deleteConfirm: "コメント #{{id}}「{{preview}}」を削除しますか？ [y/N]:",
    deleteConfirmRequired:
      "削除には確認が必要です。非対話環境では --yes を指定してください。",
    deleteCanceled: "削除をキャンセルしました。",
    deleteDone: "コメント #{{id}} を削除しました。",
  },
  api: {
    desc: "任意の esa API パスを呼びます（エスケープハッチ）",
    pathArg: "/ で始まる API パス（例: /v1/teams/{team}/posts）",
    methodOpt: "HTTP メソッド（既定は GET、--input 指定時は POST）",
    fieldOpt: "クエリパラメータを key=value で指定（繰り返し可）",
    headerOpt: "追加のリクエストヘッダを key:value で指定（繰り返し可）",
    inputOpt: "リクエスト本文を JSON ファイルから読み込みます（- で標準入力）",
    teamOpt: "パス中の {team} プレースホルダに使うチーム",
    invalidPath: "パスは単一の / で始めてください（// は不可）: {{path}}",
    invalidField: "--field の形式が不正です（key=value を期待）: {{field}}",
    invalidHeader: "--header の形式が不正です（key:value を期待）: {{header}}",
    invalidMethod:
      "対応していない --method です: {{method}}（指定可能: {{allowed}}）",
    invalidJson: "リクエスト本文が正しい JSON ではありません。",
  },
  category: {
    desc: "カテゴリを操作します",
    listDesc:
      "チームのカテゴリパス一覧を表示します (GET /v1/teams/{team_name}/categories/paths)",
    getDesc:
      "カテゴリとその配下のサブカテゴリを取得します (GET /v1/teams/{team_name}/categories)",
    topDesc:
      "トップレベルのカテゴリ一覧を表示します (GET /v1/teams/{team_name}/categories/top)",
    pathArg: "カテゴリのパス（例: dev/docs）",
    teamOpt: "対象チーム",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
    includeOpt: "追加で含める情報 (posts | parent_categories)",
    descendantPostsOpt: "子孫記事も含めます（--include posts のときのみ有効）",
    prefixOpt: "指定した文字列で始まるパスのみ",
    suffixOpt: "指定した文字列で終わるパスのみ",
    matchOpt: "指定した文字列を含むパスのみ",
    exactMatchOpt: "指定したパスと完全一致するもののみ",
    allOpt: "全ページを取得して全カテゴリパスを一度に返します",
    allPageConflict: "--all と --page は同時に指定できません。",
  },
  tag: {
    desc: "タグを操作します",
    listDesc: "チームのタグ一覧を表示します (GET /v1/teams/{team_name}/tags)",
    teamOpt: "対象チーム",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
  },
  member: {
    desc: "チームメンバーを操作します",
    listDesc:
      "チームのメンバー一覧を表示します (GET /v1/teams/{team_name}/members)",
    teamOpt: "対象チーム",
    pageOpt: "ページ番号",
    perPageOpt: "1ページあたりの件数",
    sortOpt: "ソート基準 (posts_count | joined | last_accessed)",
    orderOpt: "ソート順 (desc | asc)",
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
