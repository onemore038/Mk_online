import type { GameState, PlayerState } from "../types.js";

const HIDDEN = "?";

/**
 * 特定プレイヤー視点の GameState を作る。
 * 自分以外の手札・ドラフトパケット・山札の中身は伏せ札にする（枚数はそのまま見える）。
 * サーバーは room.game をそのまま全員へブロードキャストせず、必ずこの関数を通してから送ること
 * （手札は非公開情報という公式FAQのルールをサーバーレベルで担保するため）。
 */
export function getPlayerView(state: GameState, viewerId: string): GameState {
  const players: Record<string, PlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = id === viewerId ? p : { ...p, hand: p.hand.map(() => HIDDEN) };
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
    legend1Deck: state.legend1Deck.map(() => HIDDEN),
    legend2Deck: state.legend2Deck.map(() => HIDDEN),
  };
}
