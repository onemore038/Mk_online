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
 * cost / victoryPoints は未確認のため null（README参照）。
 */
export const STANDARD_CARDS: readonly StandardCardDefinition[] = [
  {
    id: "std.bakery",
    name: "パン屋",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置すると次ターンから「お金」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "money",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.tavern",
    name: "酒場",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置すると次ターンから「権力」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "authority",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.cakeShop",
    name: "ケーキ屋",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置すると次ターンから「魔力」パワーを1個ずつ生産する。",
    effectKind: "producePower",
    producePowerType: "magic",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.oven",
    name: "オーブン",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置すると次ターンからサイコロパンカードを1枚引ける。",
    effectKind: "produceDiceBread",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.warehouse",
    name: "倉庫",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置したターン以降、手札の上限が2枚増える。",
    effectKind: "handLimitBoost",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.church",
    name: "教会",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置すると次ターンからマーケットカードを1枚山札から引ける。",
    effectKind: "drawMarketCard",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.mixer",
    name: "ミキサー",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "魔導書カード。振ったサイコロの出目を操作できる。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.lean",
    name: "リーン",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "魔導書カード。振ったサイコロの出目を操作できる。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.rich",
    name: "リッチ",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "魔導書カード。振ったサイコロの出目を操作できる。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: false,
  },
  {
    id: "std.fingerTest",
    name: "フィンガーテスト",
    category: "standard",
    cost: null,
    victoryPoints: null,
    effectSummary: "魔導書カード。振ったサイコロの出目を操作できる。",
    effectKind: "manipulateDiceRoll",
    hasProgrammaticEffect: false,
  },
];
