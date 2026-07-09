# 作業ログ：2026-07-10 — 「動くもの」第一弾

このファイルは時系列の作業記録。仕様そのものは [docs/requirements.md](../requirements.md)、
コードベース全体のガイドは [CLAUDE.md](../../CLAUDE.md) を参照。ここには「その時点で何を作り、
何が動き、何が未着手だったか」を残す。

## この回でやったこと

1. **要件定義**（`docs/requirements.md`）
   - 目的：人間同士がオンラインで対戦するWebアプリ。AIボットでの穴埋めはしない、2人以上いれば任意人数で開始可
   - MVPは本体カードのみ。拡張1〜3は対象外
   - 技術スタック：TypeScript統一 / Node.js+Socket.IO / React+Vite / npm workspacesモノレポ

2. **`shared` パッケージ**（ゲーム状態・ルールエンジン、本体カードのみ）
   - `types.ts`：`GameState` / `PlayerState` / カードマスタ型など
   - `actions.ts`：フェイズ2のA〜G＋`DRAFT_PICK` / `RESOLVE_TURN_START` / `END_TURN` / `DISCARD_TO_HAND_LIMIT`
   - `cards/`：キャラ8種・スタンダード10種・アドバンス20種・レジェンドⅠⅡ各5種（**コスト/VP数値は未確認のため `cost: null` で「設置不可」扱い**。README参照）
   - `engine/setup.ts`：部屋作成〜ドラフト開始までのセットアップ
   - `engine/draft.ts`：開始時ドラフト（5枚配布→1枚キープ→左隣へパスを3ラウンド）
   - `engine/market.ts`：オープンマーケットの補充（トップアップ方式）
   - `engine/reducer.ts`：`applyAction(state, action, rng)` 純粋関数。例外を投げず `{ok, value|error}` を返す
   - `engine/view.ts`：**プレイヤー視点フィルタ**。他プレイヤーの手札・ドラフトパケット・山札の中身を伏せ札（`"?"`）にする。手札は非公開情報という公式ルールをサーバー側で担保するために追加
   - `socket.ts`：クライアント⇄サーバーのSocket.IOイベント契約の型（`ClientToServerEvents` / `ServerToClientEvents`）
   - テスト：vitestで28件（setup / draft / reducer / view）、すべてパス

3. **`server` パッケージ**（Node.js + Express + Socket.IO）
   - `roomStore.ts`：部屋の作成・参加をインメモリで管理（6文字の部屋コード発行）
   - `index.ts`：
     - `room:create` / `room:join` / `room:rejoin`（セッション切断からの復帰）
     - `lobby:selectCharacter` / `lobby:setInitialPower` / `lobby:start`
     - `game:action`（`playerId` はクライアント自己申告を信用せず、ソケット認証済みの値に必ず差し替え）
     - **`game:update` はルーム一斉送信ではなく、`getPlayerView` でプレイヤーごとに手札を伏せてから個別送信**（重要な設計判断）

4. **`client` パッケージ**（React + Vite）
   - `HomeScreen`（部屋作成/参加）→ `LobbyScreen`（キャラ選択・初期パワー配分・開始）→ `GameScreen`（ドラフト／ターン進行）の3画面構成
   - `GameScreen` はダイス選択→カード獲得/パワー獲得、パワー変換、場入替、レジェンド設置、手札設置、設置済みカード使用、手札上限超過時の破棄UI、ターン終了までひととおり実装
   - 見た目は機能優先の最小限スタイル（`index.css`）。デザインの作り込みはまだ

5. **結合テスト**（`scripts/integrationTest.ts`）
   - `socket.io-client` で2クライアントを実際に接続し、部屋作成→参加→ロビー→ドラフト→ターン操作→次ターンまでを自動検証
   - 途中、イベントリスナーをemitの後に登録していたことによる取りこぼしのレースコンディションを発見・修正（`.on()` は接続直後・emitより前に登録すること）
   - 手札の非公開化が実際のネットワーク越しに機能していることも確認（p1視点でp2の手札が `"?"` になる）
   - `npx tsx scripts/integrationTest.ts` で再実行可能

## 現在動く範囲

- 部屋作成・参加・ロビー（キャラ選択・初期パワー配分）・ゲーム開始
- 開始時ドラフト（3ラウンドのパス式）
- ターン開始→ダイスロール→ダイスでのパワー獲得／山札からの獲得／オープンマーケットからの獲得／パワー変換／場入替／ターン終了→次プレイヤーへ
- 手札上限超過時の破棄
- 20VP到達による最終周回・勝敗判定（エンジン側のロジックは実装済み、実戦で20VPまで到達させて確認はまだ）
- 手札・ドラフトパケット・山札中身のサーバーサイド非公開化

## 現在動かない範囲（既知）

- **カード設置（`INSTALL_CARD`）、レジェンド設置（`PLACE_LEGEND_CARD`）、設置済みカードの使用（`USE_INSTALLED_CARD`）は、コスト数値が未確認のカードでは意図的に「未実装エラー」を返す**。本体カードほぼ全てが `cost: null` のため、現状はほぼ全カードが設置不可。ここが次の最大のギャップ。
- ダイス目↔パワー種別の対応（`DIE_FACE_TO_POWER`）は暫定値。物理ダイスを見て確認が必要
- レジェンドⅠ/Ⅱの補充ルールの細部も暫定実装
- 切断・再接続時に「手番中のプレイヤーが切断したらどうするか」は未設計（`room:rejoin`で復帰自体はできる）
- UIの見た目は未着手（機能確認レベル）

## 起動方法（開発時）

```bash
npm install                        # ルートで一度
npm run dev --workspace server     # http://localhost:3001
npm run dev --workspace client     # http://localhost:5173
```

ブラウザで `http://localhost:5173` を2タブ以上開けば対戦を試せる。

検証用の自動結合テスト：

```bash
npx tsx scripts/integrationTest.ts
```

sharedのユニットテスト：

```bash
cd shared && npx vitest run
```

## 次にやることの候補

1. 本体カードのコスト・VP数値を物理カードで確認し、`shared/src/cards/*.ts` の `cost` / `victoryPoints` を埋める → `INSTALL_CARD` 等を実際に実装
2. ダイス目とパワー種別の対応を物理ダイスで確認する
3. UIの見た目を整える（現状は機能確認用の最小限スタイル）
4. 切断時の挙動（手番中の離脱をどう扱うか）を詰める
