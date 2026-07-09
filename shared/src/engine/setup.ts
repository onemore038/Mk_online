import type { GameState, PlayerState, PowerPool } from "../types.js";
import { POWER_TYPES } from "../types.js";
import { STANDARD_CARDS, ADVANCE_CARDS, LEGEND1_CARDS, LEGEND2_CARDS } from "../cards/index.js";
import { shuffle, pickRandom, type Rng } from "../rng.js";
import { EngineError } from "./errors.js";

const COPIES_PER_STANDARD_CARD = 4;
const COPIES_PER_ADVANCE_CARD = 4;
const ADVANCE_VARIETIES_PER_GAME = 10;
const LEGEND_ROW_SIZE = 3;
const DRAFT_PACKET_SIZE = 5;
const DRAFT_ROUNDS = 3;
const DEFAULT_HAND_LIMIT = 6;

/**
 * TODO(要確認): サイコロパンカードの総数は公式資料で未確認。暫定値。
 * FAQによれば「有限」であることのみ判明している。
 */
export const DICE_BREAD_TOTAL_COUNT_PLACEHOLDER = 40;

export interface SetupPlayerConfig {
  readonly playerId: string;
  readonly nickname: string;
  readonly characterId: string;
  /**
   * 初期パワーチップ4枚の配分。本来はプレイヤーが自由に選べるルールのため、
   * ここでは呼び出し側（UI）に決めてもらう想定で必須パラメータにしている。
   * 合計が4になっていることを呼び出し側で保証すること（setupGame でも検証する）。
   */
  readonly initialPower: PowerPool;
}

export interface SetupOptions {
  readonly roomId: string;
  readonly players: readonly SetupPlayerConfig[];
  readonly rng: Rng;
}

export function setupGame(options: SetupOptions): GameState {
  const { roomId, players, rng } = options;

  if (players.length < 2 || players.length > 4) {
    throw new EngineError(
      `プレイヤー数は2〜4人である必要があります（指定: ${players.length}人）`,
      "INVALID_PLAYER_COUNT",
    );
  }
  for (const p of players) {
    const total = POWER_TYPES.reduce((sum, t) => sum + p.initialPower[t], 0);
    if (total !== 4) {
      throw new EngineError(
        `初期パワーの合計は4個である必要があります（プレイヤー ${p.playerId}: ${total}個）`,
        "INVALID_INITIAL_POWER",
      );
    }
  }

  const playerOrder = players.map((p) => p.playerId);

  // --- スタンダードカード：ドラフト用パケットを配る ---
  const standardPool = shuffle(
    STANDARD_CARDS.flatMap((c) => Array(COPIES_PER_STANDARD_CARD).fill(c.id) as string[]),
    rng,
  );
  const dealCount = DRAFT_PACKET_SIZE * players.length;
  const dealtForDraft = standardPool.slice(0, dealCount);
  const undealtStandardCards = standardPool.slice(dealCount);

  const packets: Record<string, string[]> = {};
  playerOrder.forEach((playerId, i) => {
    packets[playerId] = dealtForDraft.slice(i * DRAFT_PACKET_SIZE, (i + 1) * DRAFT_PACKET_SIZE);
  });

  // --- アドバンスカード：全20種からランダムに10種を選び、4枚ずつプールに入れる ---
  const advanceVarieties = pickRandom(ADVANCE_CARDS, ADVANCE_VARIETIES_PER_GAME, rng);
  const advancePool = advanceVarieties.flatMap((c) =>
    Array(COPIES_PER_ADVANCE_CARD).fill(c.id) as string[],
  );

  // ドラフト完了後にleftoverの手札未確定カードを合流させるため、
  // この時点では「未配布の標準カード＋アドバンスプール」だけを山札の種にしておく。
  const marketDeckSeed = shuffle([...undealtStandardCards, ...advancePool], rng);

  // --- レジェンドカード：確認できたプール（各5種）からランダムに3種を場に出す ---
  const legend1Ids = shuffle(LEGEND1_CARDS.map((c) => c.id), rng);
  const legend2Ids = shuffle(LEGEND2_CARDS.map((c) => c.id), rng);

  const players_: Record<string, PlayerState> = {};
  for (const p of players) {
    players_[p.playerId] = {
      playerId: p.playerId,
      nickname: p.nickname,
      characterId: p.characterId,
      power: { ...p.initialPower },
      hand: [],
      handLimit: DEFAULT_HAND_LIMIT,
      installed: [],
      victoryPoints: 0,
      diceBreadCards: 0,
      connected: true,
    };
  }

  return {
    roomId,
    playerOrder,
    players: players_,
    currentPlayerIndex: 0,
    phase: "draft",
    draft: {
      round: 0,
      packets,
      pendingPicks: [...playerOrder],
    },
    dice: [],
    openMarket: [],
    marketDeck: marketDeckSeed,
    marketDiscard: [],
    legend1Row: legend1Ids.slice(0, LEGEND_ROW_SIZE),
    legend1Deck: legend1Ids.slice(LEGEND_ROW_SIZE),
    legend2Row: legend2Ids.slice(0, LEGEND_ROW_SIZE),
    legend2Deck: legend2Ids.slice(LEGEND_ROW_SIZE),
    legendPlacedThisTurn: false,
    diceBreadDeckCount: DICE_BREAD_TOTAL_COUNT_PLACEHOLDER,
    diceBreadDiscardCount: 0,
    turnNumber: 1,
    finalRoundTriggeredBy: null,
    winnerIds: null,
    log: [
      {
        turn: 0,
        playerId: null,
        type: "SETUP",
        detail: `ゲームを作成しました（プレイヤー ${players.length}人）`,
      },
    ],
  };
}

export const DRAFT_ROUNDS_TOTAL = DRAFT_ROUNDS;
