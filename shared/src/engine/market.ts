import type { GameState } from "../types.js";
import { shuffle, type Rng } from "../rng.js";

/** オープンマーケットに並ぶカードの「種類数」。同一カードは同じ枠に積み重なる。 */
export const OPEN_MARKET_TYPE_COUNT = 8;

/**
 * 山札からオープンマーケットを補充する。8種類のカードタイプが並ぶまで引き続ける
 * （同名カードを連続して引いた場合は同じ枠に積み重なり、種類数としては増えない）。
 * 山札が尽きた場合は捨て札をシャッフルして山札に戻す。
 */
export function refillOpenMarket(state: GameState, rng: Rng): GameState {
  let deck = [...state.marketDeck];
  let discard = [...state.marketDiscard];
  // 既存の場札はそのまま残し、種類数が8になるまで「補充」する。
  // （場を全部捨ててから呼ぶ E.オープンマーケット入替 の場合は openMarket が
  //   事前に空にされているので、結果的に0からの補充と同じになる）
  const newMarket: string[] = [...state.openMarket];
  const seenTypes = new Set<string>(newMarket);

  while (seenTypes.size < OPEN_MARKET_TYPE_COUNT) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard, rng);
      discard = [];
    }
    const cardId = deck.shift();
    if (!cardId) break;
    newMarket.push(cardId);
    seenTypes.add(cardId);
  }

  return {
    ...state,
    openMarket: newMarket,
    marketDeck: deck,
    marketDiscard: discard,
  };
}
