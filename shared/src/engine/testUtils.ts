import type { GameState, PlayerState } from "../types.js";

/** テスト用に十分な最小構成の GameState を組み立てるヘルパー。 */
export function buildTestState(overrides: Partial<GameState> = {}): GameState {
  const players: Record<string, PlayerState> = {
    p1: buildTestPlayer("p1", "char.marie"),
    p2: buildTestPlayer("p2", "char.marie"),
  };

  return {
    roomId: "test-room",
    playerOrder: ["p1", "p2"],
    players,
    currentPlayerIndex: 0,
    phase: "turnActions",
    draft: null,
    dice: [
      { face: 1, used: false },
      { face: 3, used: false },
      { face: 5, used: false },
    ],
    openMarket: [],
    marketDeck: [],
    marketDiscard: [],
    legend1Row: [],
    legend1Deck: [],
    legend2Row: [],
    legend2Deck: [],
    legendPlacedThisTurn: false,
    diceBreadDeckCount: 10,
    diceBreadDiscardCount: 0,
    turnNumber: 1,
    finalRoundTriggeredBy: null,
    winnerIds: null,
    log: [],
    ...overrides,
  };
}

export function buildTestPlayer(
  playerId: string,
  characterId: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    playerId,
    nickname: playerId,
    characterId,
    power: { money: 0, authority: 0, magic: 0 },
    hand: [],
    handLimit: 6,
    installed: [],
    victoryPoints: 0,
    diceBreadCards: 0,
    connected: true,
    ...overrides,
  };
}
