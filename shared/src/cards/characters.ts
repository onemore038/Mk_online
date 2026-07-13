import type { CharacterDefinition } from "../types.js";

/**
 * 本体キャラクター8種。
 * 能力テキストはコミュニティ攻略記事に掲載されたカード写真で確認済み（2026-07-11）。
 * shared/src/cards/README.md も参照。
 */
export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: "char.coronelia",
    name: "純白の女王 コロネリア",
    diceCount: 4,
    abilitySummary:
      "ターン開始時に金/権/魔のいずれか1種類のパワーを1つ獲得する。ターン中行動：サイコロを4つ振る。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.sophie",
    name: "神眼の錬金術師 ソフィ",
    diceCount: 3,
    abilitySummary:
      "ターン開始時にマーケットカードを山札の上から2枚獲得する。ターン中行動：サイコロを3つ振る。自分のターン中に何度でも、手札からマーケットカードを1枚捨てることで金/権/魔のいずれか1種類のパワーを1つ獲得できる。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.anne",
    name: "煌星の魔導将軍 アン",
    diceCount: 3,
    abilitySummary:
      "ゲーム開始時にサイコロパンカードを山札の上から3枚、ターン開始時に2枚ずつ獲得する。ターン中行動：サイコロを3つ振る。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.flan",
    name: "誓約の魔法騎士 フラン",
    diceCount: 3,
    abilitySummary:
      "ターン中行動：サイコロを3つ振る。マーケットカードを設置する際、手札にある同名のマーケットカード1枚を一切のコストを支払わずに同時設置してよい。手札に同名カードが2枚以上ある場合にのみ、1ターンに1回限り使用できる。アップグレード設置と併用する場合、捨て札にするカードと新設置カードが2枚ずつ必要。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.croix",
    name: "浄罪の精霊術師 クロワ",
    diceCount: 3,
    abilitySummary:
      "ターン開始前：ゲーム中1度だけ、自分のターンに何もしない代わりに、オープンマーケットに並んでいる中から好きなマーケットカードを1枚、一切のコストを支払わずに直接設置できる。ターン開始時：（このスキップ能力の使用有無に関わらず、毎ターン）お金を1つ獲得する。ターン中行動：サイコロを3つ振る。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.chocolat",
    name: "慈光の聖女 ショコラ",
    diceCount: 3,
    abilitySummary:
      "ターン開始時に金/権/魔のいずれか1種類のパワーを2つ獲得する。ターン中行動：サイコロを3つ振る。自分のターン中に何度でも、自分が所有する1つのパワーをパワー置き場に戻すことで、パワー置き場から別のパワー1つを獲得できる（1:1交換）。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.marie",
    name: "傀儡の支配者 マリー",
    diceCount: 3,
    abilitySummary:
      "常時発動：マーケットカードまたはレジェンドカードを設置する際、必要となるサイコロを1つ不要にできる。必要サイコロが1つだけならサイコロなしで設置してよい。2つ以上必要な場合、どのサイコロを不要にするかは自由に決めてよい。ターン中行動：サイコロを3つ振る。",
    hasProgrammaticEffect: true,
  },
  {
    id: "char.roll",
    name: "焔天の紋章術師 ロール",
    diceCount: 3,
    abilitySummary:
      "ゲーム開始時、パワーを合計10個獲得する（内訳＝金/権/魔の組み合わせは自由に決めてよい）。ターン開始時に権力パワーを1つ獲得する。ターン中行動：サイコロを3つ振る。",
    hasProgrammaticEffect: true,
  },
];
