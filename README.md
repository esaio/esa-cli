# esa-cli

Official CLI for [esa.io](https://esa.io).

記事・コメント・カテゴリ・タグ・メンバー・添付ファイルをコマンドラインから操作できます。
端末では読みやすく、パイプでは扱いやすい形で出力し、`--json` を付ければ指定した
フィールドだけを JSON で取り出せるので、`jq` などと組み合わせてスクリプトに組み込めます。

## Requirements

- Node.js >= 24.18.0
- npm >= 11.7.0

## Installation

```bash
npm install --ignore-scripts -g @esaio/esa-cli
```

インストールすると `esa` コマンドが使えます。

```bash
esa --version
esa --help
```

インストールせずに単発で実行することもできます。

```bash
npx --ignore-scripts @esaio/esa-cli auth status
```

## Usage

### 認証

OAuth（ブラウザ）でログインします。ブラウザで認可すると、取得したトークンが
**OS 標準の資格情報ストア**（macOS Keychain / Windows Credential Manager /
Linux Secret Service）に保存されます。いずれも使えない環境では
`~/.config/esa-cli` に AES-256-GCM で暗号化したファイルへ保存されます。

```bash
esa auth login     # ブラウザで OAuth 認証してトークンを保存
esa auth status    # 現在の認証状態を表示（--json で機械可読に）
esa auth logout    # トークンを失効・削除
```

CI など非対話環境で使う場合は、OAuth ログインの代わりに環境変数 `ESA_ACCESS_TOKEN`
に Personal Access Token を設定すれば認証できます（**PAT v2 を推奨**）。

### API コマンド

認証後、esa API を叩けます。出力の形式は[出力形式](#出力形式)を参照してください。

既定では API リクエストにクライアント側のタイムアウトを設けません。無応答で待たせたくない場合は、グローバルオプション `--timeout <秒>`（正の整数）をコマンド名の前に置いて上限を指定できます（例: `esa --timeout 30 post list`）。

```bash
esa user                    # 認証ユーザーの情報 (GET /v1/user)
esa team list                        # 所属チーム一覧 (GET /v1/teams)
esa team list --role owner           # 権限で絞り込み (member | owner)

esa post list                        # 記事一覧 (GET /v1/teams/{team}/posts)
esa post list -q "wip:true"          # 検索クエリで絞り込み
esa post list --page 2 --per-page 50 # ページング
esa post list --json number,url      # 指定フィールドだけを JSON で
esa post search "keyword"            # 記事を検索（list -q と同じエンドポイント）
esa post view 123           # 記事を1件表示（get でも引ける）
esa post backlinks 123      # この記事を参照している記事の一覧
esa post revisions 123      # リビジョン一覧（rollback 用の番号を調べる）
```

記事の作成・更新・追記・アーカイブ・削除もできます。本文（Markdown）は `--body` でインライン指定するか、`--body-file <path>`（`-` で標準入力）で渡します。

```bash
# 作成。名前に "/" を含めるとカテゴリになる（--category でも指定可）
esa post create "dev/docs/新しい記事" --body "本文" --tags a,b
cat body.md | esa post create "タイトル" --body-file -  # 標準入力から本文
esa post create "タイトル" --ship                        # WIP を解除して作成（既定は WIP）

esa post update 123 --name "改題" --ship  # タイトル変更＋Ship（指定した項目のみ更新）
esa post append 123 --body "末尾に追記"    # 本文の末尾に追記
esa post prepend 123 --body-file intro.md # 本文の先頭に追記

esa post duplicate 123                    # WIP 記事として複製（既定は同じチーム）
esa post duplicate 123 --target-team other # 別チームに複製
esa post rollback 123 5                    # リビジョン 5 の内容に戻す（新リビジョンとして記録）

esa post archive 123        # Archived/ カテゴリに移してアーカイブ
esa post delete 123         # 確認プロンプトの後に削除
esa post delete 123 --yes   # 確認をスキップ（非対話環境では --yes 必須）
```

記事へのコメントも操作できます。本文（Markdown）は記事と同じく `--body` / `--body-file`（`-` で標準入力）で渡します。

```bash
esa comment list            # チーム全体のコメント一覧 (GET /v1/teams/{team}/comments)
esa comment list --post 123 # 特定の記事のコメントに絞り込み
esa comment view 456        # コメントを1件表示（get でも引ける）
esa comment view 456 --stargazers # スターしたメンバーも含める

esa comment create 123 --body "コメント本文"        # 記事 123 にコメント
cat comment.md | esa comment create 123 --body-file - # 標準入力から本文
esa comment update 456 --body "修正後の本文"         # コメントを更新
esa comment create 123 --body "代理投稿" --user alice # 別ユーザーとして投稿（owner 権限）

esa comment delete 456       # 確認プロンプトの後に削除
esa comment delete 456 --yes # 確認をスキップ（非対話環境では --yes 必須）
```

カテゴリ・タグ・メンバーの一覧も取得できます。

```bash
esa category list                 # カテゴリパス一覧（ページング。GET /v1/teams/{team}/categories/paths）
esa category list --all           # 全ページを辿って全カテゴリパスをまとめて取得
esa category list --prefix dev/   # 前方一致で絞り込み（--suffix / --match / --exact-match も可）
esa tag list                      # タグ一覧 (GET /v1/teams/{team}/tags)
esa member list                   # メンバー一覧 (GET /v1/teams/{team}/members)
esa member list --sort posts_count --order desc # 投稿数の多い順に並べる
esa team stats                    # チームの統計情報 (GET /v1/teams/{team}/stats)
```

### 添付ファイル

`upload` でファイルをアップロードし、`sign` で署名付き URL を取得し、`download` で実体を
取得します（`download` は内部で署名してからダウンロードします）。

```bash
esa attachment upload ./diagram.png                   # ファイルをアップロード (POST /v1/teams/{team}/attachments)
esa attachment upload ./diagram.png --name figure.png # ファイル名を指定してアップロード
esa attachment sign /uploads/x.png                    # 署名付きURLを取得 (GET /v1/teams/{team}/signed_urls)
esa attachment sign /uploads/x.png --expires-in 3600  # 有効期限を1時間に
esa attachment download https://files.esa.io/uploads/x.png -o ./x.png # 実体をファイルに保存
esa attachment download /uploads/x.png > x.png        # 標準出力に書き出してリダイレクト
```

`upload` は stdout に添付の URL を出します。そのまま Markdown（`![alt](url)` など）に
記載すると、アップロードしたファイルを記事やコメントに埋め込めます。名前やサイズも
必要なら `--json url,name,size` のように指定してください。

署名の対象はセキュアチーム（セキュア添付）のファイルのみです。非セキュアチームの
添付は公開 URL（`img.esa.io`）で配信されるため署名は不要で、
`esa attachment download <公開URL>` で直接取得できます。

### フィードバック

esa.io 運営へのフィードバックを送信します。本文は `-m, --message` でインライン指定するか、
`--message-file <path>`（`-` で標準入力）で渡します（`--body` / `--body-file` は
それぞれの別名）。送信元クライアント（esa-cli のバージョン・OS など）は自動で添付されます。

```bash
esa feedback create -m "改善要望です"                    # 運営へ送信 (POST /v1/feedbacks)
cat feedback.md | esa feedback create --message-file -   # 標準入力から本文
esa feedback create -m "このチームの件で" --team docs      # 特定チームに紐づけて送信
```

### 任意の API を叩く（`esa api`）

専用コマンドが用意されていない API パスには、`esa api` で直接アクセスできます（任意パスへのエスケープハッチ）。認証・ベース URL・トークン更新は既存の仕組みをそのまま使います。レスポンスは JSON で stdout に出ます。

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

### 出力形式

**JSON は `--json` を指定したときだけ出ます。** 既定では、端末なら人が読みやすい形、パイプなら機械が扱いやすいテキストになります。唯一の例外は `esa api` で、API のレスポンスをそのまま返すのが役割なので、本文のある応答は常に JSON で出します（204 など本文が無ければ何も出しません）。

#### 一覧

`post list` / `post search` / `post backlinks` / `post revisions` /
`comment list` / `category list` / `tag list` / `member list` / `team list` /
`attachment sign`

| 出力先 | 形式 |
| --- | --- |
| 端末 | 桁を揃えたテーブル。日時は相対表示（例: `2 hours ago`） |
| パイプ | タブ区切り。見出しなし、色なし、日時は ISO 8601 |

値に含まれるタブや改行は、列や行の区切りと紛れないよう空白に均されます。元の値が必要な場合は `--json` を使ってください。

```bash
esa post list                   # 端末ではテーブル
esa post list | cut -f1,2       # パイプではタブ区切り（列位置で扱える）
```

#### 1件の表示

`post view` / `comment view` / `user` / `team stats`

端末では見出しと項目を並べます。本文を持つ `post view` / `comment view` は続けて本文も出します。本文（Markdown）は描画せずそのまま出すので、コピーして編集元へ貼り戻せます。

```
$ esa post view 14184
日報/2026/07/26/esa-cli微調整 #14184
  - State: Ship
  - Category: 日報/2026/07/26
  - Tags:
  - Updated by: ppworks
  - Updated: 1 hour ago
  - Revision: 4
  - Comments: 0
  - URL: https://ware2.esa.io/posts/14184

## Task
- [ ] ...
```

パイプ時はタブ区切りのキーと値になり、本文の前に `--` が入ります。

```
$ esa post view 14184 | head -3
wip	Ship
category	日報/2026/07/26
tags
```

#### 作成・更新

`post create` / `update` / `append` / `prepend` / `archive` / `duplicate` / `rollback`、
`comment create` / `update`、`attachment upload`

**stdout には URL だけ**を出し、確認の1行は stderr に回します。URL をそのまま次のコマンドへ渡せます。

```bash
$ esa post create "日報/新しい記事" --body "本文"
✓ Created #14187 日報/新しい記事        # stderr
https://ware2.esa.io/posts/14187        # stdout
```

削除（`post delete` / `comment delete`）は、新しく辿れるものが生まれないので stdout に何も出さず、`✓` の1行だけを stderr に出します。`auth refresh` も同じですが、こちらは `--json` を付けたときだけトークンの状態を stdout に出せます。

`auth status` は状態の報告なので出力先で形を変えず、常に人が読める形を出します（`--json` で機械可読にできます）。

`attachment download` は添付データそのものを stdout に流すため、この規則の外です（`--output` を付けるとファイルに保存し、`✓` を stderr に出します）。

#### `--json`

リソースを返すコマンドでは、指定したフィールドだけを JSON で出せます。フィールド名を省くと候補が一覧表示されます。返すものが無いコマンド（`post delete` / `comment delete` / `attachment download` / `feedback create` / `config`）には付いていません。

```bash
esa post list --json number,full_name,url
esa post view 14184 --json body_md
esa post list --json            # 指定できるフィールドを表示
```

色は `NO_COLOR` を設定すると無効になります（パイプ時は元から付きません）。

### `jq` と組み合わせる（標準入力）

`--json` で JSON を stdout に出せて、本文やリクエストボディを標準入力（`-`）から受け取れるので、`jq` でパイプして繋げられます。エスケープ（改行やクォート）を `jq` に任せられるのも利点です。

渡し方は 2 種類あります。

- `esa post/comment ... --body-file -`: **本文テキストだけ**を受け取る。`jq -r`（raw 出力）でテキストを組み立てる
- `esa api ... --input -`: **ボディ JSON 全体**を受け取る。`jq -n`（新規生成）で `{post: …}` や `{comment: …}` を組み立てる

```bash
# 取得した JSON を jq -r でコメント本文に整形して投稿
esa post view 123 --json tags \
  | jq -r '"現在のタグ（\(.tags | length)個）: \(.tags | join(", "))"' \
  | esa comment create 123 --body-file -

# jq -n でボディ JSON 全体を組み立てて POST（--user なども載せられる）
jq -n --arg body "LGTM :+1:" --arg user alice \
  '{comment: {body_md: $body, user: $user}}' \
  | esa api /v1/teams/{team}/posts/123/comments --input -

# 取得 → 加工 → 書き戻し（既存タグに1つ追加して PATCH）
esa post view 123 --json tags \
  | jq '{post: {tags: (.tags + ["新タグ"])}}' \
  | esa api /v1/teams/{team}/posts/123 -X PATCH --input -
```

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
esa config --help                  # 対応している設定キーの一覧
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

## AI エージェントから使う

Claude Code / Cursor / Gemini CLI / Codex CLI などの AI エージェントから esa-cli を
操作させるためのスキルを [esa-skills](https://github.com/esaio/esa-skills) で配布して
います。自然言語で記事の検索・作成・コメントなどを行えます。

各エージェントの marketplace / extension からの導入に加え、横断ツール
[`npx skills`](https://github.com/vercel-labs/skills) でも導入できます。

```bash
npx skills add esaio/esa-skills
```

導入方法の詳細は [esa-skills の README](https://github.com/esaio/esa-skills#installation) を参照してください。

## Authentication flow

- Authorization Code + PKCE（S256）フロー。client_secret を持たない public app。
- コールバックは `http://127.0.0.1:<ランダムポート>/callback`。
- 各エンドポイントはハードコードせず、実行時に **discovery**
  （`/.well-known/oauth-authorization-server`, RFC 8414）から取得する。
- トークンの保存先は OS により自動判定（上記）。

### 環境変数

| 変数 | 説明 | 既定値 |
| --- | --- | --- |
| `ESA_OAUTH_SCOPE` | 要求するスコープ（スペース区切り） | `read:post write:post delete:post read:comment write:comment delete:comment read:category read:tag read:attachment write:attachment read:revision read:member read:team read:user write:feedback` |
| `ESA_OAUTH_CLIENT_ID` | public app の client_id を上書き | 内蔵の公式 public app |
| `ESA_API_BASE_URL` | API のベース URL。discovery の取得元でもある | `https://api.esa.io` |
| `ESA_ACCESS_TOKEN` | OAuth を使わずアクセストークンを直接指定 | （未設定） |
| `ESA_TEAM` | post 系コマンドの対象チーム（`--team` の既定） | （未設定） |
| `ESA_LANG` | 表示言語（`en` / `ja`）。最優先で使われる | OS ロケール→`en` |
| `ESA_DEBUG` | `1` のときエラーのスタックトレースを表示 | （未設定） |

## Development

リポジトリを clone して開発する場合の手順です。

```bash
npm install

# ソースを直接実行（tsx）
npm run dev -- auth status

# ビルド（bin/ に出力）
npm run build

# ビルド後のバイナリを実行
node bin/index.js auth status
```

### Scripts

| Script | 説明 |
| --- | --- |
| `npm run dev` | tsx でソースを直接実行 |
| `npm run build` | tsdown で `bin/` にビルド |
| `npm test` | vitest（watch） |
| `npm run test:run` | vitest（1 回実行） |
| `npm run lint` | biome によるチェック |
| `npm run lint:fix` | biome による自動修正 |
| `npm run type-check` | tsc による型チェック |

## License

MIT
