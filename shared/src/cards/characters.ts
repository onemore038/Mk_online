import type { CharacterDefinition } from "../types.js";

/**
 * 本体キャラクター8種。
 * 数値・能力の詳細は shared/src/cards/README.md を参照（一部推定を含む）。
 */
export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: "char.coronelia",
    name: "純白の女王 コロネリア",
    diceCount: 4,
    abilitySummary:
      "ターン開始時にパワーを1種類獲得する。ターン中はサイコロを4個振る。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.sophie",
    name: "神眼の錬金術師 ソフィ",
    diceCount: 3,
    abilitySummary:
      "ターン開始時にマーケットカードを2枚獲得する。手札のカードを捨ててパワーに変換できる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.anne",
    name: "煌星の魔道将軍 アン",
    diceCount: 3,
    abilitySummary:
      "ゲーム開始時にサイコロパンカード3枚、各ターン開始時に2枚獲得する。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.flan",
    name: "誓約の魔法騎士 フラン",
    diceCount: 3,
    abilitySummary: "同名のマーケットカード2枚を無コストで同時設置できる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.croix",
    name: "浄罪の精霊術師 クロワ",
    diceCount: 3,
    abilitySummary:
      "ゲーム中1度だけターンをスキップし、オープンマーケットから1枚を無コストで設置し、パワーを1個獲得する。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.chocolat",
    name: "慈光の聖女 ショコラ",
    diceCount: 3,
    abilitySummary: "ターン開始時にパワーを2個獲得する。パワーを交換できる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.marie",
    name: "傀儡の支配者 マリー",
    diceCount: 3,
    abilitySummary: "設置時に必要なサイコロ1個を不要にできる。",
    hasProgrammaticEffect: false,
  },
  {
    id: "char.roll",
    name: "焔天の紋章術師 ロール",
    diceCount: 3,
    abilitySummary:
      "ゲーム開始時に追加で権力パワー10個を自由配分する。ターン開始時に権力パワーを1個獲得する。",
    hasProgrammaticEffect: false,
  },
];
