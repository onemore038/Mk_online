import type { MarketCardDefinition } from "../types.js";

export interface LegendCardDefinition extends MarketCardDefinition {
  readonly category: "legend1" | "legend2";
}

/**
 * 本体レジェンドカードⅠ。確認できた5種（毎試合3枚が場に並ぶ）。
 * cost / victoryPoints は未確認のため null（README参照）。
 */
export const LEGEND1_CARDS: readonly LegendCardDefinition[] = [
  {
    id: "leg1.koppepanShrine",
    name: "コッペパン神殿",
    category: "legend1",
    cost: null,
    victoryPoints: null,
    effectSummary: "特定の出目のサイコロ3個とパワー8個が設置条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg1.frenchBreadHeroStatue",
    name: "フランスパンの英雄像",
    category: "legend1",
    cost: null,
    victoryPoints: null,
    effectSummary: "特定の出目のサイコロ3個とパワー8個が設置条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg1.blackWitchMansion",
    name: "黒き魔女の館",
    category: "legend1",
    cost: null,
    victoryPoints: null,
    effectSummary: "特定の出目のサイコロ3個とパワー8個が設置条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg1.bagelTower",
    name: "ベーグルの塔",
    category: "legend1",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "サイコロまたはサイコロパンで1〜6の出目をそれぞれ1回ずつ出すことが設置条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg1.rainbowDragonEgg",
    name: "幻虹竜のたまご",
    category: "legend1",
    cost: null,
    victoryPoints: null,
    effectSummary: "3種のパワーを各8個、計24個が設置条件。",
    hasProgrammaticEffect: false,
  },
];

/**
 * 本体レジェンドカードⅡ。確認できた5種（毎試合3枚が場に並ぶ）。
 * cost / victoryPoints は未確認のため null（README参照）。
 */
export const LEGEND2_CARDS: readonly LegendCardDefinition[] = [
  {
    id: "leg2.eggBenedictMall",
    name: "エッグベネディクトモール",
    category: "legend2",
    cost: null,
    victoryPoints: null,
    effectSummary: "決められたスタンダードカード4種を設置済みであることが条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg2.grandGrimoireLibrary",
    name: "大魔導図書館",
    category: "legend2",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "魔導書4種類（ミキサー・リーン・リッチ・フィンガーテスト）を1枚ずつ捨て札にすることが条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg2.polepoleBirdSanctuary",
    name: "ポレポレ鳥の秘境",
    category: "legend2",
    cost: null,
    victoryPoints: null,
    effectSummary: "手札からマーケットカードを14枚捨て札にすることが条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg2.infiniteMirrorMaze",
    name: "無限鏡の大迷宮",
    category: "legend2",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "サイコロとサイコロパンの合計36以上を使用済みにすることが条件。",
    hasProgrammaticEffect: false,
  },
  {
    id: "leg2.twilightWheatField",
    name: "黄昏の麦隴",
    category: "legend2",
    cost: null,
    victoryPoints: null,
    effectSummary: "倉庫・オーブンの設置と、任意の目のサイコロパン8枚が条件。",
    hasProgrammaticEffect: false,
  },
];
