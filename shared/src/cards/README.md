# カードデータの確度について

このディレクトリのカードデータは、公式ルールブックPDFおよびコミュニティの攻略記事に掲載されたカード写真（2026-07-11に確認）を突き合わせて再構成したものです。

- **キャラクター**（`characters.ts`）: 能力テキストをカード写真で確認済み。
- **スタンダードカード**（`standard.ts`）: 効果・設置コスト・VPともにカード写真で確認済み。
- **アドバンスカード**（`advance.ts`）: 全20種、効果・設置コスト・VPともにカード写真で確認済み（`royalBakeryGuild`＝王立パン協会の「出目1 または 出目6」という特殊なダイス条件も拡大画像で確認済み）。ただし `fiveStarNecklace`（五ツ星のネックレス）のパワー内訳（お金/権力の比率）のみ、写真解像度上なお確度中程度。
- **レジェンドカード**（`legend.ts`）: 全10種、設置条件・VPともにカード写真で確認済み。`leg2.polepoleBirdSanctuary`（ポレポレ鳥の秘境）と `leg2.infiniteMirrorMaze`（無限鏡の大迷宮）は、`CardCost` に追加した `requiredAnyHandDiscardCount`（任意の手札マーケットカードを指定枚数捨てる）・`requiredPipSum`（ダイス・サイコロパンの出目合計が指定値以上になるよう使用する）で表現し、`engine/reducer.ts` の `placeLegendCard` で実装済み（`PlaceLegendCardAction` の `anyDiscardCardIds` / `dieIndices` + `diceBreadIndices` で対象を指定する）。

**ダイスの出目条件について**: `cost.dice` は必要なダイスの「個数」を表し、実際の出目条件（例: パン屋はお金の目＝1か2のダイスを1個要求）は `cost.diceFaceGroups`（`{ faces, count }` の配列）で表現する。出目の一致検証は `engine/diceFaceMatching.ts` の二部マッチングで行い、`installCard`/`placeLegendCard`（`engine/reducer.ts`）から呼び出される。ベーグルの塔（1〜6の出目を重複なく1つずつ）のような条件も、出目1〜6それぞれ1個ずつを要求する6グループとして表現している。ただし写真からの読み取りのため、要求出目の一部確度には幅がある（各カード定義のコメント参照）。

`victoryPoints` が `null` で `victoryPointsFormula` があるカードは、固定VPではなく盤面状況に応じた計算式でVPが決まることを表す（`tokensOnCard` はカード上に置かれたトークンの数がそのままVPになり、`engine/reducer.ts` の `useInstalledCard`（`adv.darkVault`）でトークンの積み上げを実装済み）。動的VPは `engine/cardEffects.ts` の `computeTotalVictoryPoints` で計算し、20VP到達判定・最終勝敗判定に使うほか、`engine/view.ts` の `getPlayerView` でクライアントへ送る `victoryPoints` にも反映する（内部の `player.victoryPoints` フィールド自体は基礎分のみを保持する）。`hasProgrammaticEffect: false` は、コスト・VPが判明していても、カード固有の能動効果がエンジンにまだ実装されていないことを表す（現在すべてのカードで `true`）。`PlayerState.diceBreadCards` はサイコロパン1枚＝配列1要素（出目つき）で保持し、ドロー処理は `engine/cardEffects.ts` の `drawDiceBread` で実装済み（ただし山札の出目構成比は一次資料未確認のため、出目は乱数で1〜6を割り当てる暫定実装）。
