import type { GameState } from "../types.js";
import type { DraftPickAction } from "../actions.js";
import type { Rng } from "../rng.js";
import { EngineError, type EngineResult, ok, fail } from "./errors.js";
import { refillOpenMarket } from "./market.js";

const DRAFT_ROUNDS = 3;

export function applyDraftPick(
  state: GameState,
  action: DraftPickAction,
  rng: Rng,
): EngineResult<GameState> {
  if (state.phase !== "draft" || !state.draft) {
    return fail(new EngineError("現在はドラフトフェイズではありません", "WRONG_PHASE"));
  }
  const draft = state.draft;

  if (!draft.pendingPicks.includes(action.playerId)) {
    return fail(
      new EngineError(
        "このプレイヤーは既に今ラウンドのピックを終えています",
        "ALREADY_PICKED",
      ),
    );
  }
  const packet = draft.packets[action.playerId] ?? [];
  const cardIndex = packet.indexOf(action.cardId);
  if (cardIndex === -1) {
    return fail(
      new EngineError(
        "指定されたカードは現在のパケットに含まれていません",
        "CARD_NOT_IN_PACKET",
      ),
    );
  }

  const remainingPacket = [...packet.slice(0, cardIndex), ...packet.slice(cardIndex + 1)];
  const newPackets = { ...draft.packets, [action.playerId]: remainingPacket };
  const newPendingPicks = draft.pendingPicks.filter((id) => id !== action.playerId);

  const player = state.players[action.playerId];
  if (!player) {
    return fail(new EngineError("不明なプレイヤーです", "UNKNOWN_PLAYER"));
  }
  const newPlayers = {
    ...state.players,
    [action.playerId]: { ...player, hand: [...player.hand, action.cardId] },
  };

  let newState: GameState = {
    ...state,
    draft: { ...draft, packets: newPackets, pendingPicks: newPendingPicks },
    players: newPlayers,
    log: [
      ...state.log,
      {
        turn: 0,
        playerId: action.playerId,
        type: "DRAFT_PICK",
        detail: `${action.cardId} をキープしました`,
      },
    ],
  };

  if (newPendingPicks.length === 0) {
    newState = advanceDraftRound(newState, rng);
  }

  return ok(newState);
}

/**
 * 全員がそのラウンドのピックを終えたときに呼ばれる。
 * パケットを左隣（turnOrderで次のプレイヤー）に渡し、次ラウンドへ進む。
 * 全3ラウンド終了していれば、ドラフトを終了して山札を確定させる。
 */
function advanceDraftRound(state: GameState, rng: Rng): GameState {
  const draft = state.draft;
  if (!draft) return state;

  const nextRound = draft.round + 1;

  if (nextRound >= DRAFT_ROUNDS) {
    // 残った未ピックのカードは全てマーケット山札に合流させる
    const leftover = Object.values(draft.packets).flat();
    const combinedDeck = [...state.marketDeck, ...leftover];

    let finalized: GameState = {
      ...state,
      draft: null,
      phase: "turnStart",
      marketDeck: combinedDeck,
      log: [
        ...state.log,
        { turn: 0, playerId: null, type: "DRAFT_COMPLETE", detail: "ドラフトが終了しました" },
      ],
    };
    finalized = refillOpenMarket(finalized, rng);
    return finalized;
  }

  // パケットを turnOrder の次のプレイヤーへ渡す（左隣に渡すイメージ）
  const n = state.playerOrder.length;
  const rotatedPackets: Record<string, string[]> = {};
  state.playerOrder.forEach((playerId, i) => {
    const fromPlayer = state.playerOrder[(i - 1 + n) % n]!;
    rotatedPackets[playerId] = draft.packets[fromPlayer] ?? [];
  });

  return {
    ...state,
    draft: {
      round: nextRound,
      packets: rotatedPackets,
      pendingPicks: [...state.playerOrder],
    },
  };
}
