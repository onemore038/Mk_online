import type { MarketCardDefinition } from "../types.js";

export interface AdvanceCardDefinition extends MarketCardDefinition {
  readonly category: "advance";
}

/**
 * 本体アドバンスカード20種。1試合につきランダムに10種が使用される。
 * cost / victoryPoints は未確認のため null（README参照）。
 */
export const ADVANCE_CARDS: readonly AdvanceCardDefinition[] = [
  {
    id: "adv.premiumBakery",
    name: "高級パン屋",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "パン屋の上位版。コストは約2倍だがパワー生産は3倍。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.grandTavern",
    name: "豪華な酒場",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "酒場の上位版。コストは約2倍だがパワー生産は3倍。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.masterCakeShop",
    name: "名匠のケーキ屋",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "ケーキ屋の上位版。コストは約2倍だがパワー生産は3倍。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.magicOven",
    name: "魔法のオーブン",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "オーブンの上位版。サイコロパン獲得の安定性が向上する。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.blackMarket",
    name: "闇市",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "魔導書・倉庫以外のスタンダードカードの効果を1つにまとめて選べる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.thievesGuild",
    name: "盗賊ギルド",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "他プレイヤーの所持パワー数を参照し、一定数以上持つプレイヤーから効果が発動する。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.protectionKnights",
    name: "みかじめ騎士団",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "他プレイヤーがマーケットカードを設置する度にパワーを得られる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.taxAlley",
    name: "徴税の路地裏",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "他プレイヤーがマーケットカードを獲得する度にパワーを得られる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.royalBakeryGuild",
    name: "王立パン協会",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "他プレイヤーがサイコロパンカードを1枚獲得する度にパワーを得られる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.twoStarBracelet",
    name: "二ツ星のブレスレット",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "得点カード。設置タイミングが遅いほど不利になりやすい。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.fiveStarNecklace",
    name: "五ツ星のネックレス",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "得点カード。二ツ星のブレスレットの上位互換的な位置づけ。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.armsDealer",
    name: "武器商人",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "設置した瞬間に大量のパワーを獲得する。効果は自分だけでなく全プレイヤーに及ぶ。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.harvestFestival",
    name: "大地の収穫祭",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置するとサイコロパンカードを3枚引ける。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.paneteriaAmusementPark",
    name: "パネテリア遊園地",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置するとオープンマーケットの入れ替えを行う。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.blackCatCasino",
    name: "黒猫の賭場",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "設置した際にマーケット山札を1枚引く。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.bargainRing",
    name: "値切りの指輪",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "パワーを生産せず、カード設置コストそのものを軽減する。複数枚設置で重ね掛け可能。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.beautifulQueenStatue",
    name: "麗しき女王像",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "自分の場に設置済みのカードの権力コスト合計4につき1VP。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.blackMarketBakery",
    name: "脱法パン屋",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "自分が設置した「パン屋」（スタンダードのみ）の枚数に応じた勝利点を得る。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.darkVault",
    name: "闇金庫",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary:
      "設置後、毎ターン自分の「お金」パワーをカード上に置くことで得点に変換していく。",
    hasProgrammaticEffect: false,
  },
  {
    id: "adv.breadFairyKoppen",
    name: "パンの妖精 コッペン",
    category: "advance",
    cost: null,
    victoryPoints: null,
    effectSummary: "得点カード。同名カードを集めるほど得点効率が上がる。",
    hasProgrammaticEffect: false,
  },
];
