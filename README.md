# esa-cli

Official CLI for [esa.io](https://esa.io).

## Requirements

- Node.js >= 24.18.0
- npm >= 11.7.0

## Development

```bash
npm install

# ソースを直接実行（tsx）
npm run dev -- auth status

# ビルド（bin/ に出力）
npm run build

# ビルド後のバイナリを実行
node bin/index.js auth status
```

## Usage

### 認証

OAuth（ブラウザ）でログインします。ブラウザで認可すると、取得したトークンが
**OS 標準の資格情報ストア**（macOS Keychain / Windows Credential Manager /
Linux Secret Service）に保存されます。いずれも使えない環境では
`~/.config/esa-cli` に AES-256-GCM で暗号化したファイルへ保存されます。

```bash
esa auth login     # ブラウザで OAuth 認証してトークンを保存
esa auth status    # 現在の認証状態を表示（JSON）
esa auth refresh   # refresh token でアクセストークンを更新
esa auth logout     # トークンを失効・削除
```

### API コマンド

認証後、esa API を叩けます。レスポンスは JSON で stdout に出力するので `jq` 等に流せます。

```bash
esa user                    # 認証ユーザーの情報 (GET /v1/user)
esa team list                        # 所属チーム一覧 (GET /v1/teams)
esa team list --role owner           # 権限で絞り込み (member | owner)
esa team list --page 2 --per-page 50 # ページング

esa post list               # 記事一覧 (GET /v1/teams/{team}/posts)
esa post list -q "wip:true" # 検索クエリで絞り込み
esa post search "keyword"   # 記事を検索（list -q と同じエンドポイント）
esa post get 123            # 記事を1件取得
```

記事の作成・更新・追記・アーカイブ・削除もできます。本文（Markdown）は `--body` でインライン指定するか、`--body-file <path>`（`-` で標準入力）で渡します。

```bash
# 作成。名前に "/" を含めるとカテゴリになる（--category でも指定可）
esa post create "dev/docs/新しい記事" --body "本文" --tags a,b
cat note.md | esa post create "タイトル" --body-file -  # 標準入力から本文
esa post create "タイトル" --ship                        # WIP を解除して作成（既定は WIP）

esa post update 123 --name "改題" --ship  # タイトル変更＋Ship（指定した項目のみ更新）
esa post append 123 --body "末尾に追記"    # 本文の末尾に追記
esa post prepend 123 --body-file intro.md # 本文の先頭に追記

esa post archive 123        # Archived/ カテゴリに移してアーカイブ
esa post delete 123         # 確認プロンプトの後に削除
esa post delete 123 --yes   # 確認をスキップ（非対話環境では --yes 必須）
```

記事へのコメントも操作できます。本文（Markdown）は記事と同じく `--body` / `--body-file`（`-` で標準入力）で渡します。

```bash
esa comment list            # チーム全体のコメント一覧 (GET /v1/teams/{team}/comments)
esa comment list --post 123 # 特定の記事のコメントに絞り込み
esa comment get 456         # コメントを1件取得
esa comment get 456 --stargazers # スターしたメンバーも含める

esa comment create 123 --body "コメント本文"        # 記事 123 にコメント
cat review.md | esa comment create 123 --body-file - # 標準入力から本文
esa comment update 456 --body "修正後の本文"         # コメントを更新
esa comment create 123 --body "代理投稿" --user alice # 別ユーザーとして投稿（owner 権限）

esa comment delete 456       # 確認プロンプトの後に削除
esa comment delete 456 --yes # 確認をスキップ（非対話環境では --yes 必須）
```

### 任意の API を叩く（`esa api`）

専用コマンドが用意されていないエンドポイントには、`esa api` で直接アクセスできます（`gh api` 相当のエスケープハッチ）。認証・ベース URL・トークン更新は既存の仕組みをそのまま使います。レスポンスは JSON で stdout に出ます。

```bash
esa api /v1/user                                  # GET（既定）
esa api /v1/teams/{team}/posts -f q=wip:true -f per_page=5  # -f はクエリ、{team} は自動解決
esa api /v1/teams/{team}/comments/456 -X DELETE   # メソッドを明示

# 本文は生 JSON を --input（- で標準入力）で渡す。--input があれば既定で POST
echo '{"post":{"name":"Hi","wip":false}}' \
  | esa api /v1/teams/{team}/posts --input -
esa api /v1/teams/{team}/comments/456 -X PATCH --input body.json
```

- `-X, --method`: HTTP メソッド。省略時は GET（`--input` があれば POST）
- `-f, --field key=value`: クエリパラメータ（繰り返し可）
- `--input <file>`: リクエスト本文の JSON（`-` で標準入力）
- `-H, --header key:value`: 追加ヘッダ（繰り返し可）
- パス中の `{team}` は対象チーム（下記の解決順、`--team` でも指定可）に置換されます

### 対象チームの指定

post / comment 系コマンドはチームを対象に動きます。チームは次の順で解決されます:

1. `--team <name>` フラグ
2. 環境変数 `ESA_TEAM`
3. 設定ファイルの既定チーム（`esa config set default-team <name>`）
4. 所属チームが1つだけならそれを自動採用
5. 複数所属で未指定ならエラー（`--team` か既定チームの設定を促す）

```bash
esa config set default-team docs   # 既定チームを設定
esa config get default-team        # 設定値を表示
esa post list --team docs          # 明示指定
```

### 表示言語（i18n）

メッセージと `--help` は日本語（`ja`）と英語（`en`）に対応しています。
使用言語は次の順で決まります（判定できない場合は既定の **英語**）:

1. 環境変数 `ESA_LANG`（`en` / `ja`）
2. 設定ファイルの `language`（`esa config set language ja`）
3. OS のロケール（`LC_ALL` / `LC_MESSAGES` / `LANG`。例: `ja_JP.UTF-8` → `ja`）

```bash
ESA_LANG=ja esa --help        # 一時的に日本語で実行
esa config set language ja    # 既定を日本語にする
esa config get language       # 設定値を表示
```

### 認証の優先順位

API リクエストの認証は次の順で選ばれます:

1. `esa auth login` で保存した **OAuth トークン**（期限が近づくと送信前に自動更新）
2. 環境変数 **`ESA_ACCESS_TOKEN`**
3. どちらも無ければエラー（`esa auth login` を案内）

## Authentication flow

- Authorization Code + PKCE（S256）フロー。client_secret を持たない public app。
- コールバックは `http://127.0.0.1:<ランダムポート>/callback`。
- 各エンドポイントはハードコードせず、実行時に **discovery**
  （`/.well-known/oauth-authorization-server`, RFC 8414）から取得する。
- トークンの保存先は OS により自動判定（上記）。

### 環境変数

| 変数 | 説明 | 既定値 |
| --- | --- | --- |
| `ESA_OAUTH_SCOPE` | 要求するスコープ（スペース区切り） | `read:post write:post read:comment write:comment read:category read:tag read:member read:team read:user` |
| `ESA_OAUTH_CLIENT_ID` | public app の client_id を上書き | 内蔵の公式 public app |
| `ESA_API_BASE_URL` | API のベース URL。discovery の取得元でもある | `https://api.esa.io` |
| `ESA_ACCESS_TOKEN` | OAuth を使わずアクセストークンを直接指定 | （未設定） |
| `ESA_TEAM` | post 系コマンドの対象チーム（`--team` の既定） | （未設定） |
| `ESA_LANG` | 表示言語（`en` / `ja`）。最優先で使われる | OS ロケール→`en` |

## Scripts

| Script | 説明 |
| --- | --- |
| `npm run dev` | tsx でソースを直接実行 |
| `npm run build` | tsdown で `bin/` にビルド |
| `npm test` | vitest（watch） |
| `npm run test:run` | vitest（1 回実行） |
| `npm run lint` | biome によるチェック |
| `npm run lint:fix` | biome による自動修正 |
| `npm run type-check` | tsc による型チェック |

## Project structure

esa-mcp-server のディレクトリ構成を参考にしています。

```
src/
  index.ts               # CLI エントリポイント（commander）
  commands/              # サブコマンド定義
    index.ts             # コマンド登録の集約
    auth.ts              # `esa auth` コマンド群（login/logout/refresh/status）
    user.ts              # `esa user`
    team.ts              # `esa team list`
    post.ts              # `esa post` コマンド群（list/search/get/create/update/append/prepend/archive/delete）
    comment.ts           # `esa comment` コマンド群（list/get/create/update/delete）
    api.ts               # `esa api` 任意エンドポイント（gh api 相当のエスケープハッチ）
    body-input.ts        # 本文の入力（--body / --body-file / 標準入力）
    confirm.ts           # y/N の確認プロンプト（delete で使用）
    config.ts            # `esa config set/get`（既定チーム・表示言語）
    parse.ts             # オプション・引数の共通バリデーション
  api/                   # esa API クライアント
    client.ts            # openapi-fetch クライアント（認証・送信前のトークン更新）
    resolve-team.ts      # 対象チームの解決（--team / ESA_TEAM / 既定 / 単一所属）
    response.ts          # レスポンスの取り出しとエラー整形
  i18n/                  # 表示言語（i18next）
    index.ts             # i18next の初期化と翻訳関数 t
    resolve-language.ts  # 使用言語の判定（ESA_LANG / 設定 / OS ロケール）
    locales/             # 言語リソース（en / ja）
  auth/                  # OAuth 認証とトークン保存
    oauth.ts             # Authorization Code + PKCE フロー
    discovery.ts         # 認可サーバーのメタデータ取得 (RFC 8414)
    resolve-auth.ts      # 認証方式の選択（OAuth / ESA_ACCESS_TOKEN / none）
    pkce.ts              # PKCE / state 生成
    callback.ts          # ループバック HTTP サーバー
    open-browser.ts      # 既定ブラウザの起動（OS 標準コマンド）
    token-store.ts       # 保存先の判定と振り分け
    keychain.ts          # macOS Keychain
    credential-manager.ts # Windows Credential Manager
    secret-service.ts    # Linux Secret Service
    encrypted-store.ts   # フォールバックの暗号化ファイル
    machine-id.ts        # 暗号化ファイルの鍵に使うマシン固有 ID
    types.ts             # TokenSet 型
  config/                # 設定・環境変数
    index.ts
    paths.ts             # 設定・トークンの保存先ディレクトリ
    file-store.ts        # 設定ファイル (~/.config/esa-cli/config.json) の読み書き
  generated/             # openapi.yaml から生成した API 型（npm run update-esa-api）
    api-types.ts
```

## License

MIT
