import type { MarketCardDefinition } from "../types.js";

export interface LegendCardDefinition extends MarketCardDefinition {
  readonly category: "legend1" | "legend2";
}

/**
 * 本体レジェンドカードⅠ。確認できた5種（毎試合3枚が場に並ぶ）。
 * cost / victoryPoints はコミュニティ攻略記事に掲載されたカード写真で確認済み
 * （2026-07-11、shared/src/cards/README.md 参照）。
 *
 * 注意: コッペパン神殿・フランスパンの英雄像・黒き魔女の館は、それぞれ「特定の1種類のパワーに対応する
 * 出目のダイス3個」を要求する（コッペパン神殿=お金の目、フランスパンの英雄像=権力の目、黒き魔女の館=魔力の目）。
 * ベーグルの塔は「1〜6の出目をそれぞれ1つずつ」という一致条件を diceFaceGroups で
 * 出目1〜6それぞれ1個ずつの6グループとして表現している。出目の一致検証は engine/diceFaceMatching.ts 参照。
 */
export const LEGEND1_CARDS: readonly LegendCardDefinition[] = [
  {
    id: "leg1.koppepanShrine",
    name: "コッペパン神殿",
    category: "legend1",
    cost: { dice: 3, money: 8, diceFaceGroups: [{ faces: [1, 2], count: 3 }] },
    victoryPoints: 7,
    effectSummary: "お金の目のダイス3個とお金パワー8個が設置条件。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg1.frenchBreadHeroStatue",
    name: "フランスパンの英雄像",
    category: "legend1",
    cost: { dice: 3, authority: 8, diceFaceGroups: [{ faces: [3, 4], count: 3 }] },
    victoryPoints: 8,
    effectSummary:
      "権力の目のダイス3個と権力パワー8個が設置条件。対応する魔導書（出目3or4を作れるもの）が無いため他の2枚より1VP高い。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg1.blackWitchMansion",
    name: "黒き魔女の館",
    category: "legend1",
    cost: { dice: 3, magic: 8, diceFaceGroups: [{ faces: [5, 6], count: 3 }] },
    victoryPoints: 7,
    effectSummary: "魔力の目のダイス3個と魔力パワー8個が設置条件。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg1.bagelTower",
    name: "ベーグルの塔",
    category: "legend1",
    cost: {
      dice: 6,
      diceFaceGroups: [
        { faces: [1], count: 1 },
        { faces: [2], count: 1 },
        { faces: [3], count: 1 },
        { faces: [4], count: 1 },
        { faces: [5], count: 1 },
        { faces: [6], count: 1 },
      ],
    },
    victoryPoints: 8,
    effectSummary:
      "サイコロまたはサイコロパンで1〜6の出目をそれぞれ1回ずつ出すことが設置条件。パワーは不要。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg1.rainbowDragonEgg",
    name: "幻虹竜のたまご",
    category: "legend1",
    cost: { money: 8, authority: 8, magic: 8 }, // ダイス不要
    victoryPoints: 9,
    effectSummary: "3種のパワーを各8個、計24個が設置条件。ダイスの出目には左右されない。",
    hasProgrammaticEffect: true,
  },
];

/**
 * 本体レジェンドカードⅡ。確認できた5種（毎試合3枚が場に並ぶ）。
 * cost / victoryPoints はコミュニティ攻略記事に掲載されたカード写真で確認済み
 * （2026-07-11、shared/src/cards/README.md 参照）。
 * いずれもダイス・パワーではなく「特定カードを捨て札にする」ことで設置する
 * （`cost.requiredDiscards` 参照）。この捨て札コストの実際の消費処理は
 * `engine/reducer.ts` の `placeLegendCard` / `payRequiredDiscards` で実装済み。
 */
export const LEGEND2_CARDS: readonly LegendCardDefinition[] = [
  {
    id: "leg2.eggBenedictMall",
    name: "エッグベネディクトモール",
    category: "legend2",
    cost: {
      requiredDiscards: [
        { cardId: "std.bakery", count: 1, from: "installed" },
        { cardId: "std.tavern", count: 1, from: "installed" },
        { cardId: "std.cakeShop", count: 1, from: "installed" },
        { cardId: "std.church", count: 1, from: "installed" },
      ],
    },
    victoryPoints: 13,
    effectSummary:
      "設置済みの[パン屋][酒場][ケーキ屋][教会]を1枚ずつ捨て札にすることで設置できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg2.grandGrimoireLibrary",
    name: "大魔導図書館",
    category: "legend2",
    cost: {
      requiredDiscards: [
        { cardId: "std.lean", count: 1, from: "installed" },
        { cardId: "std.rich", count: 1, from: "installed" },
        { cardId: "std.mixer", count: 1, from: "installed" },
        { cardId: "std.fingerTest", count: 1, from: "installed" },
      ],
    },
    victoryPoints: 9,
    effectSummary:
      "設置済みの[リーン][リッチ][ミキサー][フィンガーテスト]の魔導書4種類を1枚ずつ捨て札にすることで設置できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg2.polepoleBirdSanctuary",
    name: "ポレポレ鳥の秘境",
    category: "legend2",
    // 「手札のマーケットカードなら何でもよい14枚」という条件。プレイヤーが捨てる14枚を
    // PLACE_LEGEND_CARD の anyDiscardCardIds で指定する（engine/reducer.ts 参照）。
    cost: { requiredAnyHandDiscardCount: 14 },
    victoryPoints: 10,
    effectSummary: "手札からマーケットカードを14枚捨て札にすることで設置できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg2.infiniteMirrorMaze",
    name: "無限鏡の大迷宮",
    category: "legend2",
    // 「ダイス・サイコロパンの出目合計36以上」という条件。プレイヤーが充てるダイス／サイコロパンを
    // PLACE_LEGEND_CARD の dieIndices／diceBreadIndices で指定する（engine/reducer.ts 参照）。
    cost: { requiredPipSum: 36 },
    victoryPoints: 10,
    effectSummary:
      "サイコロまたはサイコロパンで、あるいはその両方によって合計36以上の目を出し、それらをすべて使用済みにすることで設置できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "leg2.twilightWheatField",
    name: "黄昏の麦隴",
    category: "legend2",
    cost: {
      requiredDiscards: [
        { cardId: "std.warehouse", count: 1, from: "installed" },
        { cardId: "std.oven", count: 1, from: "installed" },
      ],
      requiredDiceBreadCount: 8,
    },
    victoryPoints: 12,
    effectSummary:
      "設置済みの[倉庫]1枚、[オーブン]1枚と、手札のサイコロパンカード8枚（目は問わない）を捨て札にすることで設置できる。",
    hasProgrammaticEffect: true,
  },
];
