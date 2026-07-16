# esa-cli

Official CLI for [esa.io](https://esa.io).

> [!NOTE]
> 現在は最小構成（hello world）の段階です。

## Requirements

- Node.js >= 24.14.0
- npm >= 11.7.0

## Development

```bash
npm install

# ソースを直接実行（tsx）
npm run dev -- auth login
# => hello

# ビルド（bin/ に出力）
npm run build

# ビルド後のバイナリを実行
node bin/index.js auth login
# => hello
```

## Usage

```bash
esa auth login
# => hello
```

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
  index.ts          # CLI エントリポイント（commander）
  commands/         # サブコマンド定義
    index.ts        # コマンド登録の集約
    auth.ts         # `esa auth` コマンド群
  config/           # 設定・環境変数
    index.ts
  __tests__/        # テスト
```

## License

MIT
