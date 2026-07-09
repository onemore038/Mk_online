import { describe, expect, it } from "vitest";
import { setupGame } from "./setup.js";
import { createSeededRng } from "../rng.js";

function players(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    nickname: `Player${i + 1}`,
    characterId: "char.marie",
    initialPower: { money: 4, authority: 0, magic: 0 },
  }));
}

describe("setupGame", () => {
  it("2〜4人でセットアップできる", () => {
    for (const n of [2, 3, 4]) {
      const state = setupGame({ roomId: "r", players: players(n), rng: createSeededRng(1) });
      expect(state.playerOrder).toHaveLength(n);
      expect(state.phase).toBe("draft");
    }
  });

  it("1人・5人はエラーになる", () => {
    expect(() =>
      setupGame({ roomId: "r", players: players(1), rng: createSeededRng(1) }),
    ).toThrow(/2〜4人/);
    expect(() =>
      setupGame({ roomId: "r", players: players(5), rng: createSeededRng(1) }),
    ).toThrow(/2〜4人/);
  });

  it("初期パワーの合計が4でなければエラーになる", () => {
    const bad = [
      {
        playerId: "p1",
        nickname: "P1",
        characterId: "char.marie",
        initialPower: { money: 1, authority: 0, magic: 0 },
      },
      {
        playerId: "p2",
        nickname: "P2",
        characterId: "char.marie",
        initialPower: { money: 4, authority: 0, magic: 0 },
      },
    ];
    expect(() => setupGame({ roomId: "r", players: bad, rng: createSeededRng(1) })).toThrow(
      /初期パワーの合計は4個/,
    );
  });

  it("各プレイヤーに5枚のドラフトパケットが配られる", () => {
    const state = setupGame({ roomId: "r", players: players(3), rng: createSeededRng(42) });
    for (const playerId of state.playerOrder) {
      expect(state.draft?.packets[playerId]).toHaveLength(5);
    }
    expect(state.draft?.pendingPicks).toEqual(state.playerOrder);
  });

  it("レジェンドカードは各列3枚ずつ場に出る", () => {
    const state = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(7) });
    expect(state.legend1Row).toHaveLength(3);
    expect(state.legend2Row).toHaveLength(3);
  });

  it("同じシードなら同じ結果になる（再現性）", () => {
    const a = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(123) });
    const b = setupGame({ roomId: "r", players: players(2), rng: createSeededRng(123) });
    expect(a.draft?.packets).toEqual(b.draft?.packets);
    expect(a.legend1Row).toEqual(b.legend1Row);
  });
});
