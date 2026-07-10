import type { MarketCardDefinition, PowerType } from "../types.js";

/**
 * 生産・補助系スタンダードカードの効果分類。
 * コスト数値は未確認だが、効果の種類は generic engine ロジックで扱えるよう分類しておく。
 */
export type StandardEffectKind =
  | "producePower"
  | "produceDiceBread"
  | "handLimitBoost"
  | "drawMarketCard"
  | "manipulateDiceRoll";

export interface StandardCardDefinition extends MarketCardDefinition {
  readonly category: "standard";
  readonly effectKind: StandardEffectKind;
  readonly producePowerType?: PowerType;
}

/**
 * 本体スタンダードカード10種。毎試合すべて使用される。
 * cost / victoryPoints は公式ルールブック配布元のコミュニティ攻略記事に掲載されたカード写真で確認済み
 * （2026-07-11、shared/src/cards/README.md 参照）。
 *
 * 注意: `cost.dice` は必要なダイスの「個数」、`cost.diceFaceGroups` は要求される出目の内訳
 * （お金=1or2／権力=3or4／魔力=5or6）を表す。出目の一致は engine/diceFaceMatching.ts で検証する。
 * 倉庫のみ出目を問わない（diceFaceGroups 未指定）。
 */
export const STANDARD_CARDS: readonly StandardCardDefinition[] = [
  {
    id: "std.bakery",
    name: "パン屋",
    category: "standard",
    cost: { dice: 1, money: 2, diceFaceGroups: [{ faces: [1, 2], count: 1 }] },
    victoryPoints: 1,
    effectSummary: "設置すると次ターンから「お金」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "money",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.tavern",
    name: "酒場",
    category: "standard",
    cost: { dice: 1, authority: 2, diceFaceGroups: [{ faces: [3, 4], count: 1 }] },
    victoryPoints: 1,
    effectSummary: "設置すると次ターンから「権力」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "authority",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.cakeShop",
    name: "ケーキ屋",
    category: "standard",
    cost: { dice: 1, magic: 2, diceFaceGroups: [{ faces: [5, 6], count: 1 }] },
    victoryPoints: 1,
    effectSummary: "設置すると次ターンから「魔力」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "magic",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.oven",
    name: "オーブン",
    category: "standard",
    cost: { dice: 1, authority: 3, diceFaceGroups: [{ faces: [3, 4], count: 1 }] },
    victoryPoints: 1,
    effectSummary: "設置すると次ターンからサイコロパンカードを山札の上から1枚獲得する。",
    effectKind: "produceDiceBread",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.warehouse",
    name: "倉庫",
    category: "standard",
    cost: { dice: 1 }, // 出目を問わない（diceFaceGroups未指定）
    victoryPoints: 1,
    effectSummary:
      "常時発動。手札の上限が2枚増える（設置したターンからすぐに適用される）。",
    effectKind: "handLimitBoost",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.church",
    name: "教会",
    category: "standard",
    cost: { dice: 1, money: 2, magic: 1, diceFaceGroups: [{ faces: [5, 6], count: 1 }] },
    victoryPoints: 2,
    effectSummary: "設置すると次ターンからマーケットカードを山札の上から1枚獲得する。",
    effectKind: "drawMarketCard",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.mixer",
    name: "ミキサーの魔導書",
    category: "standard",
    cost: { magic: 3 },
    victoryPoints: 0,
    effectSummary: "魔導書カード。ターン中1回使用：任意の数のサイコロを振り直す。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.lean",
    name: "リーンの魔導書",
    category: "standard",
    cost: { magic: 3 },
    victoryPoints: 0,
    effectSummary: "魔導書カード。ターン中1回使用：1つのサイコロの目を1にする。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.rich",
    name: "リッチの魔導書",
    category: "standard",
    cost: { magic: 3 },
    victoryPoints: 0,
    effectSummary: "魔導書カード。ターン中1回使用：1つのサイコロの目を6にする。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: true,
  },
  {
    id: "std.fingerTest",
    name: "フィンガーテストの魔導書",
    category: "standard",
    cost: { magic: 4 },
    victoryPoints: 0,
    effectSummary: "魔導書カード。ターン中1回使用：1つのサイコロの目を+1 or -1する。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: true,
  },
];
