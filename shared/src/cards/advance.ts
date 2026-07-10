import type { MarketCardDefinition } from "../types.js";

export interface AdvanceCardDefinition extends MarketCardDefinition {
  readonly category: "advance";
}

/**
 * 本体アドバンスカード20種。1試合につきランダムに10種が使用される。
 * cost / victoryPoints はコミュニティ攻略記事に掲載されたカード写真で確認済み
 * （2026-07-11、shared/src/cards/README.md 参照）。
 *
 * 注意: `cost.dice` は必要なダイスの「個数」、`cost.diceFaceGroups` は要求される出目の内訳を表す。
 * 出目の一致は engine/diceFaceMatching.ts で検証する。`royalBakeryGuild` は「出目1」または「出目6」
 * という他とは異なる特殊な二択。`fiveStarNecklace` のパワー内訳は写真の解像度上、確度がやや低い（要再確認）。
 */
export const ADVANCE_CARDS: readonly AdvanceCardDefinition[] = [
  {
    id: "adv.premiumBakery",
    name: "高級パン屋",
    category: "advance",
    cost: { dice: 2, money: 4, diceFaceGroups: [{ faces: [1, 2], count: 2 }] },
    victoryPoints: 2,
    effectSummary:
      "パン屋の上位版。設置すると次ターンから「お金」パワーを3個ずつ生産する。アップグレード設置：設置済みの[パン屋]を1枚捨て札にすることで、設置コストのダイスをすべて不要にできる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.grandTavern",
    name: "豪華な酒場",
    category: "advance",
    cost: { dice: 2, authority: 4, diceFaceGroups: [{ faces: [3, 4], count: 2 }] },
    victoryPoints: 2,
    effectSummary:
      "酒場の上位版。設置すると次ターンから「権力」パワーを3個ずつ生産する。アップグレード設置：設置済みの[酒場]を1枚捨て札にすることで、設置コストのダイスをすべて不要にできる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.masterCakeShop",
    name: "名匠のケーキ屋",
    category: "advance",
    cost: { dice: 2, magic: 4, diceFaceGroups: [{ faces: [5, 6], count: 2 }] },
    victoryPoints: 2,
    effectSummary:
      "ケーキ屋の上位版。設置すると次ターンから「魔力」パワーを3個ずつ生産する。アップグレード設置：設置済みの[ケーキ屋]を1枚捨て札にすることで、設置コストのダイスをすべて不要にできる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.magicOven",
    name: "魔法のオーブン",
    category: "advance",
    cost: { dice: 2, authority: 2, magic: 2, diceFaceGroups: [{ faces: [3, 4], count: 2 }] }, // 拡大画像で確認、権力の目のみ
    victoryPoints: 2,
    effectSummary:
      "オーブンの上位版。設置すると次ターンからサイコロパンカードを山札の上から2枚獲得する。アップグレード設置：設置済みの[オーブン]を1枚捨て札にすることで、設置コストのダイスをすべて不要にできる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.blackMarket",
    name: "闇市",
    category: "advance",
    cost: { dice: 1, money: 1, magic: 1, diceFaceGroups: [{ faces: [1, 2], count: 1 }] },
    victoryPoints: 2,
    effectSummary:
      "設置すると次ターンから、以下3つのうち1つを実行する：マーケットカードを山札の上から1枚獲得する／サイコロパンカードを山札の上から1枚獲得する／パワー置き場から好きな種類のパワーを1つ獲得する。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.thievesGuild",
    name: "盗賊ギルド",
    category: "advance",
    cost: { dice: 1, money: 3, authority: 2, diceFaceGroups: [{ faces: [1, 2], count: 1 }] },
    victoryPoints: 2,
    effectSummary:
      "設置すると次ターンから、合計5個以上のパワーを所持している他のプレイヤーがいる場合、金/権/魔のうち1種類のパワーを以下の数だけパワー置き場から獲得する（対象人数分繰り返す）。2人プレイ時3つ／3人プレイ時2つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.protectionKnights",
    name: "みかじめ騎士団",
    category: "advance",
    cost: {
      dice: 2,
      money: 3,
      authority: 3,
      diceFaceGroups: [
        { faces: [1, 2], count: 1 },
        { faces: [3, 4], count: 1 },
      ],
    },
    victoryPoints: 2,
    effectSummary:
      "条件発動：他のプレイヤーがマーケットカードを1枚設置するたびに、金/権/魔のうち1種類のパワーを以下の数だけパワー置き場から獲得する。2人プレイ時3つ／3人プレイ時2つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.taxAlley",
    name: "徴税の路地裏",
    category: "advance",
    cost: {
      dice: 2,
      money: 2,
      authority: 1,
      magic: 1,
      diceFaceGroups: [
        { faces: [1], count: 1 },
        { faces: [6], count: 1 },
      ],
    },
    victoryPoints: 3,
    effectSummary:
      "条件発動：他のプレイヤーがマーケットカードを1種類獲得するたびに（山札から引く効果等も含む）、パワー置き場から以下の数の「お金」を獲得する。2人プレイ時3つ／3人プレイ時2つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.royalBakeryGuild",
    name: "王立パン協会",
    category: "advance",
    cost: { dice: 1, money: 2, magic: 3, diceFaceGroups: [{ faces: [1, 6], count: 1 }] }, // 拡大画像で確認済み
    victoryPoints: 2,
    effectSummary:
      "条件発動：他のプレイヤーがサイコロパンカードを1枚獲得するたびに、金/権/魔のうち1種類のパワーを以下の数だけパワー置き場から獲得する。2人プレイ時2つ／3人プレイ時1つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.twoStarBracelet",
    name: "二ツ星のブレスレット",
    category: "advance",
    cost: { dice: 2, money: 2, authority: 2, magic: 1, diceFaceGroups: [{ faces: [1, 2], count: 2 }] }, // 拡大画像で確認、お金の目のみ
    victoryPoints: 2,
    effectSummary:
      "条件発動：他のプレイヤーがサイコロの出目2を出すたびに（サイコロパンは除く）、権/魔のうち1種類のパワーを以下の数だけパワー置き場から獲得する。2人プレイ時3つ／3人プレイ時2つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.fiveStarNecklace",
    name: "五ツ星のネックレス",
    category: "advance",
    cost: { dice: 2, money: 2, authority: 2, diceFaceGroups: [{ faces: [3, 4], count: 2 }] }, // 拡大画像で確認、権力の目のみ。パワー内訳は写真解像度上なお確度中程度
    victoryPoints: 2,
    effectSummary:
      "条件発動：他のプレイヤーがサイコロの出目5を出すたびに（サイコロパンは除く）、権/魔のうち1種類のパワーを以下の数だけパワー置き場から獲得する。2人プレイ時3つ／3人プレイ時2つ／4人プレイ時1つ。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.armsDealer",
    name: "武器商人",
    category: "advance",
    cost: { dice: 1, money: 2, authority: 2, diceFaceGroups: [{ faces: [1, 2], count: 1 }] },
    victoryPoints: 1,
    effectSummary:
      "設置時に即時発動：金/権/魔の各パワーを3つずつパワー置き場から獲得する。その後、他のプレイヤーも時計回りに金/権/魔の各パワーを1つずつパワー置き場から獲得する。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.harvestFestival",
    name: "大地の収穫祭",
    category: "advance",
    cost: { dice: 1, money: 4, diceFaceGroups: [{ faces: [1, 2], count: 1 }] },
    victoryPoints: 1,
    effectSummary:
      "設置時に即時発動：サイコロパンカードを山札の上から3枚獲得する。その後、他のプレイヤーも時計回りにサイコロパンカードを山札の上から1枚ずつ獲得する。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.paneteriaAmusementPark",
    name: "パネテリア遊園地",
    category: "advance",
    cost: { dice: 1 }, // 出目を問わない（diceFaceGroups未指定）。パワー不要
    victoryPoints: 1,
    effectSummary:
      "設置時に即時発動：オープンマーケットの入れ替えを行う。その後、あなたから時計回りにプレイヤー全員がオープンマーケットからカードを1種類ずつ獲得する。このカードは自分のターン1回につき1枚だけ設置できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.blackCatCasino",
    name: "黒猫の賭場",
    category: "advance",
    cost: { dice: 2, magic: 5, diceFaceGroups: [{ faces: [5, 6], count: 2 }] },
    victoryPoints: 1,
    effectSummary:
      "設置時に即時発動：マーケットカードの山札の一番上のカードを一切のコストを支払うことなく即座に設置する。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.bargainRing",
    name: "値切りの指輪",
    category: "advance",
    cost: {
      dice: 2,
      authority: 2,
      magic: 3,
      diceFaceGroups: [
        { faces: [3, 4], count: 1 },
        { faces: [5, 6], count: 1 },
      ],
    },
    victoryPoints: 2,
    effectSummary:
      "ターン中1回使用：マーケットカードまたはレジェンドカードを設置する際、必要となるパワーを3つ不要にできる。設置に3つ以下のパワーが必要な場合はパワーなしで設置してよい。4つ以上必要な場合、どのパワーを不要にするかは自由に決めてよい。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.beautifulQueenStatue",
    name: "麗しき女王像",
    category: "advance",
    cost: { dice: 2, authority: 6, diceFaceGroups: [{ faces: [3, 4], count: 2 }] },
    victoryPoints: null,
    victoryPointsFormula: { kind: "perPowerCostEvery", powerType: "authority", divisor: 4 },
    effectSummary:
      "常時発動（得点計算）：自分が設置したマーケットカード・レジェンドカードの権力コスト合計4つにつき1VP（端数切り捨て）。このカード自体の設置コストの権力6も含むため、設置した時点で1VP確定する。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.blackMarketBakery",
    name: "脱法パン屋",
    category: "advance",
    cost: { money: 10 }, // ダイス不要
    victoryPoints: null,
    victoryPointsFormula: { kind: "perInstalledCardCount", cardId: "std.bakery", pointsPerCard: 2, base: 1 },
    effectSummary:
      "常時発動（得点計算）：自分が設置した[パン屋]（スタンダードのみ）1つにつき追加の2VPを得る（基本1VP + パン屋1枚につき2VP）。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.darkVault",
    name: "闇金庫",
    category: "advance",
    cost: {
      dice: 2,
      money: 5,
      diceFaceGroups: [
        { faces: [1, 2], count: 1 },
        { faces: [5, 6], count: 1 },
      ],
    },
    victoryPoints: null,
    victoryPointsFormula: { kind: "tokensOnCard" },
    effectSummary:
      "ターン中1回使用：自分のターン中に1回、このカードの上に「お金」を3つまで載せることができる。カードの上にある「お金」1つにつき1VPとなる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "adv.breadFairyKoppen",
    name: "パンの妖精 コッペン",
    category: "advance",
    cost: { dice: 1, money: 1, magic: 3, diceFaceGroups: [{ faces: [1, 2, 5, 6], count: 1 }] },
    victoryPoints: null,
    victoryPointsFormula: {
      kind: "perInstalledCardCount",
      cardId: "adv.breadFairyKoppen",
      pointsPerCard: 1,
    },
    effectSummary:
      "常時発動（得点計算）：このカードのVPは、自分が設置した[パンの妖精 コッペン]の枚数と同じになる（1枚1VP、2枚で計4VP、3枚で計9VP、4枚で計16VP）。",
    hasProgrammaticEffect: true,
  },
];
