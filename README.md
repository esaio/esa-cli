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
esa team list               # 所属チーム一覧 (GET /v1/teams)
esa team list --role owner  # 権限で絞り込み (member | owner)

esa post list               # 記事一覧 (GET /v1/teams/{team}/posts)
esa post list -q "wip:true" # 検索クエリで絞り込み
esa post get 123            # 記事を1件取得
```

### 対象チームの指定

post 系コマンドはチームを対象に動きます。チームは次の順で解決されます:

1. `--team <name>` フラグ
2. 環境変数 `ESA_TEAM`
3. 設定ファイルの既定チーム（`esa config set default-team <name>`）
4. 所属チームが1つだけならそれを自動採用
5. 複数所属で未指定ならエラー（`--team` か既定チームの設定を促す）

```bash
esa config set default-team docs   # 既定チームを設定
esa config get                     # 現在の設定を表示
esa post list --team docs          # 明示指定
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
    post.ts              # `esa post list` / `esa post get`
    config.ts            # `esa config set/get`（既定チーム等）
    parse.ts             # オプション・引数の共通バリデーション
  api/                   # esa API クライアント
    client.ts            # openapi-fetch クライアント（認証・送信前のトークン更新）
    resolve-team.ts      # 対象チームの解決（--team / ESA_TEAM / 既定 / 単一所属）
    response.ts          # レスポンスの取り出しとエラー整形
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
    file-store.ts        # 設定ファイル (~/.config/esa-cli/config.json) の読み書き
  generated/             # openapi.yaml から生成した API 型（npm run update-esa-api）
    api-types.ts
```

## License

MIT
