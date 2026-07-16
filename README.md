# esa-cli

Official CLI for [esa.io](https://esa.io).

## Requirements

- Node.js >= 24.14.0
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
esa auth logout     # トークンを失効・削除
```

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
    auth.ts              # `esa auth` コマンド群（login/logout/status）
  auth/                  # OAuth 認証とトークン保存
    oauth.ts             # Authorization Code + PKCE フロー
    discovery.ts         # 認可サーバーのメタデータ取得 (RFC 8414)
    pkce.ts              # PKCE / state 生成
    callback.ts          # ループバック HTTP サーバー
    open-browser.ts      # 既定ブラウザの起動（OS 標準コマンド）
    token-store.ts       # 保存先の判定と振り分け
    keychain.ts          # macOS Keychain
    credential-manager.ts # Windows Credential Manager
    secret-service.ts    # Linux Secret Service
    encrypted-store.ts   # フォールバックの暗号化ファイル
    types.ts             # TokenSet 型
  config/                # 設定・環境変数
    index.ts
  __tests__/             # テスト
```

## License

MIT
