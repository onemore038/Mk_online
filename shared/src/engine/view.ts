import type { GameState, PlayerState } from "../types.js";
import { computeTotalVictoryPoints } from "./cardEffects.js";

const HIDDEN = "?";

/**
 * 特定プレイヤー視点の GameState を作る。
 * 自分以外の手札・ドラフトパケット・山札の中身は伏せ札にする（枚数はそのまま見える）。
 * サーバーは room.game をそのまま全員へブロードキャストせず、必ずこの関数を通してから送ること
 * （手札は非公開情報という公式FAQのルールをサーバーレベルで担保するため）。
 *
 * victoryPoints は、パンの妖精コッペン等の動的VP計算式（victoryPointsFormula）による加算分を
 * 含んだ合計値に差し替えて送る（内部の player.victoryPoints は基礎分のみを保持し続ける。
 * 20VP到達判定・最終勝敗判定は reducer.ts 側で computeTotalVictoryPoints を都度計算して使うため、
 * ここでの表示専用の上書きが内部状態に影響することはない）。
 */
export function getPlayerView(state: GameState, viewerId: string): GameState {
  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    const displayed = id === viewerId ? p : { ...p, hand: p.hand.map(() => HIDDEN) };
    players[id] = { ...displayed, victoryPoints: computeTotalVictoryPoints(state, id) };
  }

  const draft = state.draft
    ? {
        ...state.draft,
        packets: Object.fromEntries(
          Object.entries(state.draft.packets).map(([id, packet]) => [
            id,
            id === viewerId ? packet : packet.map(() => HIDDEN),
          ]),
        ),
      }
    : null;

  return {
    ...state,
    players,
    draft,
    marketDeck: state.marketDeck.map(() => HIDDEN),
  };
}
