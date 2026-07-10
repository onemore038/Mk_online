# デプロイ手順（Render）

離れた友人ともインターネット経由で対戦できるように、サーバーとクライアントをRenderへ本デプロイする手順。
サーバー（Socket.IOのWebサービス）とクライアント（静的サイト）を別々のサービスとしてデプロイする。

## 前提

- GitHubリポジトリ（`onemore038/Mk_online`）に最新のコードがpush済みであること
- Renderアカウントを作成し、GitHubと連携しておくこと（<https://render.com>）

## 手順

### 1. サーバーをデプロイ（Web Service）

1. Renderダッシュボードで **New +** → **Web Service**
2. `onemore038/Mk_online` リポジトリを選択
3. 設定:
   - **Root Directory**: 空欄のまま（リポジトリのルート。npm workspacesのモノレポ構成のため）
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start --workspace server`
   - **Instance Type**: Free でよい
4. 環境変数はいったん未設定のままデプロイしてよい（`CORS_ORIGIN`は手順3で設定する）
5. デプロイ完了後、割り当てられたURL（例: `https://mk-online-server-xxxx.onrender.com`）を控える

### 2. クライアントをデプロイ（Static Site）

1. Renderダッシュボードで **New +** → **Static Site**
2. 同じリポジトリ `onemore038/Mk_online` を選択
3. 設定:
   - **Root Directory**: 空欄のまま
   - **Build Command**: `npm install && npm run build --workspace client`
   - **Publish Directory**: `client/dist`
4. **Environment Variables** に追加してからデプロイ:
   - `VITE_SERVER_URL` = 手順1で控えたサーバーのURL（例: `https://mk-online-server-xxxx.onrender.com`）
   - ※ Viteはビルド時に環境変数を埋め込むため、デプロイ後に値を変えた場合は再ビルド（Manual Deploy）が必要
5. デプロイ完了後、割り当てられたURL（例: `https://mk-online-client-xxxx.onrender.com`）を控える

### 3. サーバー側にクライアントのURLを許可する

1. サーバーのサービス画面 → **Environment** タブ
2. `CORS_ORIGIN` = 手順2で控えたクライアントのURL を追加
3. 保存すると自動的に再デプロイされる

### 4. 動作確認

クライアントのURLを2台の端末（またはブラウザの別プロファイル）で開き、部屋の作成・参加ができるか確認する。

## Blueprint（`render.yaml`）を使う場合

リポジトリ直下の `render.yaml` を使うと、**New +** → **Blueprint** から上記のサーバー・クライアントをまとめて作成できる。ただし `CORS_ORIGIN` / `VITE_SERVER_URL` は `sync: false` にしてあるため、デプロイ後に手動でRenderダッシュボードから値を入れる必要がある（手順は上と同じ）。Renderの仕様変更でBlueprintのフィールド名が変わっている場合は、上記の手動手順を使うこと。

## 既知の制約（Free プラン）

- サーバー（Web Service, Free）は**15分アクセスがないとスリープ**する。スリープ後の最初のアクセスはコールドスタートで数十秒かかることがある。友人と遊ぶ前に一度サーバーのURLに直接アクセスしてウォームアップしておくと良い。
- 部屋の状態はサーバーのメモリ上にのみ保持している。サーバーが再起動・スリープから復帰すると、進行中の部屋はすべて消える。
- 無料枠のため同時接続数やリソースに制限がある（個人・友人間での利用規模を想定）。
