# MK Online

某魔法王国ボードゲーム（国産の拡大再生産系ボードゲーム。サイコロ3個と3種のパワーでカードを設置し、20VPを目指す）のオンライン対戦シミュレータ。

> このリポジトリでは、対象ボードゲームの正式タイトル・発行元名・公式サイトURLは意図的に記載していません。実装の背景・詳細ルールは [CLAUDE.md](CLAUDE.md) と [docs/requirements.md](docs/requirements.md) を参照してください。

友人・知人同士で「部屋」を作り、任意人数（2人以上）でオンライン対戦できることを目的とした個人プロジェクトです。AIボットによる人数の穴埋めは行いません。

## 構成

npm workspaces によるモノレポです。

| パッケージ | 役割 |
|---|---|
| [`shared`](shared) | ゲーム状態の型・カードデータ・ルールエンジン（純粋関数）。サーバー・クライアント共通 |
| [`server`](server) | Express + Socket.IO。部屋管理とルールエンジンの実行、状態のリアルタイム配信 |
| [`client`](client) | React + Vite。ロビー〜対戦画面のUI |

ルール・状態遷移の詳細は [CLAUDE.md](CLAUDE.md) にまとめています。

## セットアップ

Node.js 20以上が必要です。

```bash
npm install
```

## 開発サーバーの起動

サーバーとクライアントをそれぞれ別ターミナルで起動します。

```bash
npm run dev --workspace server    # http://localhost:3001
npm run dev --workspace client    # http://localhost:5173
```

ブラウザで `http://localhost:5173` を開き、部屋を作成します。別のタブ・別のブラウザ・別の端末から発行された部屋コードで参加すると対戦できます。

環境変数（任意）:

- `PORT`：サーバーのポート（既定 `3001`）
- `CORS_ORIGIN`：サーバーが許可するクライアントのオリジン（既定 `http://localhost:5173`）
- `VITE_SERVER_URL`：クライアントが接続するサーバーURL（既定 `http://localhost:3001`）

## テスト

```bash
# shared のユニットテスト（vitest）
cd shared && npx vitest run

# 型チェック
npx tsc -p shared/tsconfig.json --noEmit
npx tsc -p server/tsconfig.json --noEmit
cd client && npx tsc --noEmit

# サーバー・クライアント間の結合テスト（socket.io-client で実プロトコルを検証）
npx tsx scripts/integrationTest.ts
```

## ビルド

```bash
cd client && npm run build   # client/dist に静的ファイルを出力
```

サーバーは現状ビルド不要（`tsx` でTypeScriptを直接実行する運用）。

## 現状の制約

- カードの設置（`INSTALL_CARD`）・レジェンド設置・設置済みカードの使用は、**コスト等の数値が未確認のカードでは意図的に未実装エラーを返します**。本体カードのほとんどが該当するため、現状はゲームの前半（ドラフト・ダイス・パワー操作・場の入替）までが実戦で動く範囲です。カード効果を実装するには物理カードでコスト・VPを確認し、`shared/src/cards/*.ts` を埋める必要があります（詳細は `shared/src/cards/README.md`）。
- ダイスの出目とパワー種別の対応は暫定値です（`shared/src/types.ts` の `DIE_FACE_TO_POWER`）。
- 拡張パックのカード・キャラクターは未対応です。

作業の時系列ログは [docs/progress/](docs/progress/) にあります。
