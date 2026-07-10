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
        p1: buildTestPlayer("p1", "char.marie", { diceBreadCards: [1, 1] }),
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
    expect(result.value.players.p1!.diceBreadCards).toHaveLength(1);
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

describe("レジェンドⅠ/Ⅱの対応関係", () => {
  it("対応するⅠが未設置のⅡはlegend2Rowに無く、設置しようとするとCARD_NOT_IN_ROWになる", () => {
    const state = buildTestState({
      legendColumns: [{ legend1Id: "leg1.koppepanShrine", legend2Id: "leg2.eggBenedictMall" }],
      legend1Row: ["leg1.koppepanShrine"],
      legend2Row: [],
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.eggBenedictMall",
        row: "legend2",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CARD_NOT_IN_ROW");
  });

  it("Ⅰを設置すると、対応するⅡがlegend2Rowに追加される", () => {
    const state = buildTestState({
      legendColumns: [{ legend1Id: "leg1.rainbowDragonEgg", legend2Id: "leg2.eggBenedictMall" }],
      legend1Row: ["leg1.rainbowDragonEgg"],
      legend2Row: [],
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          power: { money: 8, authority: 8, magic: 8 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg1.rainbowDragonEgg",
        row: "legend1",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.legend1Row).toEqual([]);
    expect(result.value.legend2Row).toEqual(["leg2.eggBenedictMall"]);
  });
});

describe("レジェンドカード設置（捨て札コスト）", () => {
  it("requiredDiscards を満たしていれば設置でき、対象カードが捨て札になる", () => {
    const state = buildTestState({
      legend2Row: ["leg2.eggBenedictMall"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [
            { instanceId: "i1", cardId: "std.bakery", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i2", cardId: "std.tavern", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i3", cardId: "std.cakeShop", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i4", cardId: "std.church", installedThisTurn: false, usedThisTurn: false },
          ],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.eggBenedictMall",
        row: "legend2",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.installed.map((c) => c.cardId)).toEqual([
      "leg2.eggBenedictMall",
    ]);
    expect(result.value.marketDiscard).toEqual(
      expect.arrayContaining(["std.bakery", "std.tavern", "std.cakeShop", "std.church"]),
    );
    expect(result.value.players.p1!.victoryPoints).toBe(13);
  });

  it("requiredDiscards を満たさなければ INSUFFICIENT_DISCARD_MATERIAL で拒否される", () => {
    const state = buildTestState({
      legend2Row: ["leg2.eggBenedictMall"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.eggBenedictMall",
        row: "legend2",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INSUFFICIENT_DISCARD_MATERIAL");
  });

  it("requiredDiceBreadCount を満たしていなければ拒否される", () => {
    const state = buildTestState({
      legend2Row: ["leg2.twilightWheatField"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          diceBreadCards: [1, 1, 1],
          installed: [
            { instanceId: "i1", cardId: "std.warehouse", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i2", cardId: "std.oven", installedThisTurn: false, usedThisTurn: false },
          ],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.twilightWheatField",
        row: "legend2",
        dieIndices: [],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INSUFFICIENT_DISCARD_MATERIAL");
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

  it("手札上限はマーケットカードとサイコロパンカードの合計に適用される", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          hand: ["a", "b", "c", "d"],
          diceBreadCards: [1, 1, 1],
          handLimit: 6,
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("MUST_DISCARD_FIRST");
  });

  it("DISCARD_TO_HAND_LIMIT でサイコロパンカードを捨てて上限内に収められる", () => {
    let state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          hand: ["a", "b", "c", "d"],
          diceBreadCards: [1, 1, 1],
          handLimit: 6,
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const discardResult = applyAction(
      state,
      { type: "DISCARD_TO_HAND_LIMIT", playerId: "p1", cardIds: [], discardDiceBreadCount: 1 },
      rng(),
    );
    expect(discardResult.ok).toBe(true);
    if (!discardResult.ok) return;
    state = discardResult.value;
    expect(state.players.p1!.diceBreadCards).toHaveLength(2);
    expect(state.diceBreadDiscardCount).toBe(1);

    const endResult = applyAction(state, { type: "END_TURN", playerId: "p1" }, rng());
    expect(endResult.ok).toBe(true);
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

describe("レジェンドカード設置（任意の手札カード捨て札コスト）", () => {
  it("anyDiscardCardIds を14枚指定すればポレポレ鳥の秘境を設置できる", () => {
    const hand = Array.from({ length: 14 }, (_, i) => `card${i}`);
    const state = buildTestState({
      legend2Row: ["leg2.polepoleBirdSanctuary"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.polepoleBirdSanctuary",
        row: "legend2",
        dieIndices: [],
        anyDiscardCardIds: hand,
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual([]);
    expect(result.value.marketDiscard).toEqual(expect.arrayContaining(hand));
    expect(result.value.players.p1!.victoryPoints).toBe(10);
  });

  it("指定枚数が14枚に満たなければ DISCARD_COUNT_MISMATCH で拒否される", () => {
    const hand = Array.from({ length: 14 }, (_, i) => `card${i}`);
    const state = buildTestState({
      legend2Row: ["leg2.polepoleBirdSanctuary"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.polepoleBirdSanctuary",
        row: "legend2",
        dieIndices: [],
        anyDiscardCardIds: hand.slice(0, 13),
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DISCARD_COUNT_MISMATCH");
  });
});

describe("レジェンドカード設置（出目合計コスト）", () => {
  it("ダイスとサイコロパンの出目合計が36以上なら無限鏡の大迷宮を設置できる", () => {
    const state = buildTestState({
      legend2Row: ["leg2.infiniteMirrorMaze"],
      dice: [
        { face: 6, used: false },
        { face: 6, used: false },
        { face: 6, used: false },
        { face: 6, used: false },
      ],
      players: {
        // 4ダイス×6 = 24 + サイコロパン6+6 = 36
        p1: buildTestPlayer("p1", "char.marie", { diceBreadCards: [6, 6] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.infiniteMirrorMaze",
        row: "legend2",
        dieIndices: [0, 1, 2, 3],
        diceBreadIndices: [0, 1],
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dice.every((d) => d.used)).toBe(true);
    expect(result.value.players.p1!.diceBreadCards).toEqual([]);
    expect(result.value.diceBreadDiscardCount).toBe(2);
    expect(result.value.players.p1!.victoryPoints).toBe(10);
  });

  it("出目合計が36未満なら INSUFFICIENT_PIP_SUM で拒否される", () => {
    const state = buildTestState({
      legend2Row: ["leg2.infiniteMirrorMaze"],
      dice: [
        { face: 6, used: false },
        { face: 6, used: false },
      ],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { diceBreadCards: [6] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg2.infiniteMirrorMaze",
        row: "legend2",
        dieIndices: [0, 1],
        diceBreadIndices: [0],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INSUFFICIENT_PIP_SUM");
  });
});

describe("ダイスの出目一致検証", () => {
  it("要求と異なる出目のダイスで設置しようとするとDICE_FACE_MISMATCHで拒否される", () => {
    // std.bakery は出目1or2を1個要求する。出目5のダイスでは満たせない。
    const state = buildTestState({
      dice: [{ face: 5, used: false }],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", { hand: ["std.bakery"], power: { money: 2, authority: 0, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.bakery", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DICE_FACE_MISMATCH");
  });

  it("要求どおりの出目のダイスなら設置できる", () => {
    const state = buildTestState({
      dice: [{ face: 2, used: false }],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", { hand: ["std.bakery"], power: { money: 2, authority: 0, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.bakery", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(true);
  });

  it("2グループ条件（徴税の路地裏: 出目1を1個・出目6を1個）は同じダイスを使い回せない", () => {
    // 出目1が2個では「出目6を1個」のグループを満たせないため拒否される
    const state = buildTestState({
      dice: [
        { face: 1, used: false },
        { face: 1, used: false },
      ],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["adv.taxAlley"],
          power: { money: 2, authority: 1, magic: 1 },
        }),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "adv.taxAlley", dieIndices: [0, 1] },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DICE_FACE_MISMATCH");
  });

  it("2グループ条件を出目1個ずつで満たせば設置できる", () => {
    const state = buildTestState({
      dice: [
        { face: 1, used: false },
        { face: 6, used: false },
      ],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["adv.taxAlley"],
          power: { money: 2, authority: 1, magic: 1 },
        }),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "adv.taxAlley", dieIndices: [0, 1] },
      rng(),
    );
    expect(result.ok).toBe(true);
  });

  it("ベーグルの塔：出目が重複していると設置できない", () => {
    const state = buildTestState({
      dice: [
        { face: 1, used: false },
        { face: 1, used: false },
        { face: 3, used: false },
        { face: 4, used: false },
        { face: 5, used: false },
        { face: 6, used: false },
      ],
      legend1Row: ["leg1.bagelTower"],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat"),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg1.bagelTower",
        row: "legend1",
        dieIndices: [0, 1, 2, 3, 4, 5],
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DICE_FACE_MISMATCH");
  });

  it("ベーグルの塔：出目1〜6が1つずつ揃えば設置できる", () => {
    const state = buildTestState({
      dice: [
        { face: 1, used: false },
        { face: 2, used: false },
        { face: 3, used: false },
        { face: 4, used: false },
        { face: 5, used: false },
        { face: 6, used: false },
      ],
      legend1Row: ["leg1.bagelTower"],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat"),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "PLACE_LEGEND_CARD",
        playerId: "p1",
        cardId: "leg1.bagelTower",
        row: "legend1",
        dieIndices: [0, 1, 2, 3, 4, 5],
      },
      rng(),
    );
    expect(result.ok).toBe(true);
  });

  it("マリーの割引適用時：出目条件は残りのダイスで満たせればよい", () => {
    // std.tavern は出目3or4を1個要求するが、マリーは1個不要にできる。
    // 割引でダイス0個になるため、出目チェックは自動的に通る（提供する出目0個は常にどのグループにも矛盾しない）。
    const state = buildTestState({
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["std.tavern"], power: { money: 0, authority: 2, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.tavern", dieIndices: [] },
      rng(),
    );
    expect(result.ok).toBe(true);
  });
});
