import { describe, expect, it } from "vitest";
import { setupGame } from "./setup.js";
import { applyAction } from "./reducer.js";
import { createSeededRng } from "../rng.js";
import type { GameState } from "../types.js";

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    nickname: `Player${i + 1}`,
    characterId: "char.marie",
    initialPower: { money: 4, authority: 0, magic: 0 },
  }));
}

function runFullDraft(state: GameState, rng = createSeededRng(1)): GameState {
  let s = state;
  while (s.phase === "draft" && s.draft) {
    const nextPlayerId = s.draft.pendingPicks[0]!;
    const packet = s.draft.packets[nextPlayerId]!;
    const result = applyAction(
      s,
      { type: "DRAFT_PICK", playerId: nextPlayerId, cardId: packet[0]! },
      rng,
    );
    if (!result.ok) throw result.error;
    s = result.value;
  }
  return s;
}

describe("ドラフトフェイズ", () => {
  it("3ラウンド終えると全員の手札が3枚になり turnStart フェイズへ進む", () => {
    const initial = setupGame({ roomId: "r", players: players(3), rng: createSeededRng(1) });
    const final = runFullDraft(initial);

    expect(final.phase).toBe("turnStart");
    expect(final.draft).toBeNull();
    for (const playerId of final.playerOrder) {
      expect(final.players[playerId]!.hand).toHaveLength(3);
    }
  });

  it("ドラフト終了後にオープンマーケットが補充される", () => {
    const initial = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(2) });
    const final = runFullDraft(initial);
    const distinctTypes = new Set(final.openMarket);
    expect(distinctTypes.size).toBeGreaterThan(0);
    expect(distinctTypes.size).toBeLessThanOrEqual(8);
  });

  it("自分のパケットにないカードはピックできない", () => {
    const initial = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(3) });
    const result = applyAction(
      initial,
      { type: "DRAFT_PICK", playerId: "p1", cardId: "__not_in_packet__" },
      createSeededRng(1),
    );
    expect(result.ok).toBe(false);
  });

  it("ドラフトフェイズ以外ではDRAFT_PICKできない", () => {
    const initial = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(4) });
    const final = runFullDraft(initial);
    const cardId = Object.values(final.players)[0]!.hand[0]!;
    const result = applyAction(
      final,
      { type: "DRAFT_PICK", playerId: "p1", cardId },
      createSeededRng(1),
    );
    expect(result.ok).toBe(false);
  });
});
