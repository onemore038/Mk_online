import { describe, expect, it } from "vitest";
import { applyAction } from "./reducer.js";
import { buildTestState, buildTestPlayer } from "./testUtils.js";
import { createSeededRng } from "../rng.js";

const rng = () => createSeededRng(1);

describe("RESOLVE_TURN_START", () => {
  it("キャラクターのダイス数だけダイスを振り、turnActionsへ進む", () => {
    const state = buildTestState({ phase: "turnStart", dice: [] });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("turnActions");
    // char.marie の diceCount は 3
    expect(result.value.dice).toHaveLength(3);
  });

  it("手番でないプレイヤーは実行できない", () => {
    const state = buildTestState({ phase: "turnStart", dice: [] });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p2" }, rng());
    expect(result.ok).toBe(false);
  });
});

describe("GAIN_POWER", () => {
  it("ダイスを使ってパワーを1個獲得できる（出目→パワー種別の対応表に従う）", () => {
    const state = buildTestState({
      dice: [{ face: 1, used: false }], // face 1 -> money（暫定マッピング）
    });
    const result = applyAction(
      state,
      { type: "GAIN_POWER", playerId: "p1", source: { kind: "die", dieIndex: 0 } },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(1);
    expect(result.value.dice[0]!.used).toBe(true);
  });

  it("使用済みダイスは再利用できない", () => {
    const state = buildTestState({ dice: [{ face: 1, used: true }] });
    const result = applyAction(
      state,
      { type: "GAIN_POWER", playerId: "p1", source: { kind: "die", dieIndex: 0 } },
      rng(),
    );
    expect(result.ok).toBe(false);
  });

  it("サイコロパンカードで好きなパワーを獲得できる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { diceBreadCards: 2 }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "GAIN_POWER", playerId: "p1", source: { kind: "diceBread", powerType: "magic" } },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.magic).toBe(1);
    expect(result.value.players.p1!.diceBreadCards).toBe(1);
    expect(result.value.diceBreadDiscardCount).toBe(1);
  });
});

describe("CONVERT_POWER", () => {
  it("同種パワー2個を異種パワー1個に変換できる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { power: { money: 2, authority: 0, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "CONVERT_POWER", playerId: "p1", from: "money", to: "authority" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(0);
    expect(result.value.players.p1!.power.authority).toBe(1);
  });

  it("パワーが不足していれば失敗する", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { power: { money: 1, authority: 0, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "CONVERT_POWER", playerId: "p1", from: "money", to: "authority" },
      rng(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("REFRESH_MARKET", () => {
  it("3種のパワーを1個ずつ払い、場札を入れ替える", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { power: { money: 1, authority: 1, magic: 1 } }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      openMarket: ["std.bakery", "std.tavern"],
      marketDeck: ["std.cakeShop", "std.oven", "std.warehouse", "std.church", "std.mixer", "std.lean", "std.rich", "std.fingerTest"],
    });
    const result = applyAction(state, { type: "REFRESH_MARKET", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power).toEqual({ money: 0, authority: 0, magic: 0 });
    expect(result.value.marketDiscard).toEqual(expect.arrayContaining(["std.bakery", "std.tavern"]));
    expect(new Set(result.value.openMarket).size).toBeGreaterThan(0);
  });
});

describe("レジェンドカード設置の1ターン1枚制限", () => {
  it("既に設置済みなら2枚目は拒否される", () => {
    const state = buildTestState({ legendPlacedThisTurn: true, legend1Row: ["leg1.koppepanShrine"] });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg1.koppepanShrine",
        row: "legend1",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("LEGEND_LIMIT");
  });
});

describe("手札上限とターン終了", () => {
  it("手札が上限を超えていると END_TURN は拒否される", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["a", "b", "c", "d", "e", "f", "g"], handLimit: 6 }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MUST_DISCARD_FIRST");
  });

  it("DISCARD_TO_HAND_LIMIT で上限まで捨てれば END_TURN できる", () => {
    let state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["a", "b", "c", "d", "e", "f", "g"], handLimit: 6 }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const discardResult = applyAction(
      state,
      { type: "DISCARD_TO_HAND_LIMIT", playerId: "p1", cardIds: ["g"] },
      rng(),
    );
    expect(discardResult.ok).toBe(true);
    if (!discardResult.ok) return;
    state = discardResult.value;

    const endResult = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(endResult.ok).toBe(true);
    if (!endResult.ok) return;
    expect(endResult.value.currentPlayerIndex).toBe(1);
    expect(endResult.value.phase).toBe("turnStart");
  });

  it("設置済みカードの使用済みフラグはターン終了時にリセットされる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [
            { instanceId: "i1", cardId: "std.mixer", installedThisTurn: false, usedThisTurn: true },
          ],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.installed[0]!.usedThisTurn).toBe(false);
  });
});

describe("20VP到達と終了判定", () => {
  it("誰かが20VPに到達すると最終周回に入り、一周後にゲームが終了する", () => {
    let state = buildTestState({
      playerOrder: ["p1", "p2", "p3"],
      currentPlayerIndex: 0,
      players: {
        p1: buildTestPlayer("p1", "char.marie", { victoryPoints: 20 }),
        p2: buildTestPlayer("p2", "char.marie", { victoryPoints: 5 }),
        p3: buildTestPlayer("p3", "char.marie", { victoryPoints: 3 }),
      },
    });

    let result = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;
    expect(state.finalRoundTriggeredBy).toBe("p1");
    expect(state.phase).toBe("turnStart");
    expect(state.currentPlayerIndex).toBe(1);

    // 次のプレイヤーの手番として turnActions フェイズへ進めてから END_TURN する
    result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p2" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result = applyAction(result.value, { type: "END_TURN", playerId: "p2" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;
    expect(state.phase).toBe("turnStart");
    expect(state.currentPlayerIndex).toBe(2);

    result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p3" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result = applyAction(result.value, { type: "END_TURN", playerId: "p3" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;
    expect(state.phase).toBe("gameOver");
    expect(state.winnerIds).toEqual(["p1"]);
  });
});

describe("INSTALL_CARD / PLACE_LEGEND_CARD（数値未確認カード）", () => {
  it("コストが未確認のカードは設置できず、NotImplementedErrorになる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["std.bakery"] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.bakery", dieIndices: [] },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_IMPLEMENTED");
    // 失敗時は手札が変化していないこと（純粋関数であること）を確認
    expect(state.players.p1!.hand).toEqual(["std.bakery"]);
  });
});
