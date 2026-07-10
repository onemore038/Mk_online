import { describe, expect, it } from "vitest";
import { applyAction } from "./reducer.js";
import { buildTestState, buildTestPlayer } from "./testUtils.js";
import { createSeededRng } from "../rng.js";
import { computeTotalVictoryPoints, applyOtherPlayersDiceRollTrigger } from "./cardEffects.js";

const rng = () => createSeededRng(1);

function installed(cardId: string, overrides: Partial<{ tokens: number }> = {}) {
  return {
    instanceId: `inst-${cardId}-${Math.random()}`,
    cardId,
    installedThisTurn: false,
    usedThisTurn: false,
    ...overrides,
  };
}

describe("RESOLVE_TURN_START：設置済みカードのターン開始時効果", () => {
  it("パン屋・酒場・ケーキ屋が設置済みなら対応するパワーを獲得する", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [installed("std.bakery"), installed("std.tavern"), installed("std.cakeShop")],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power).toEqual({ money: 1, authority: 1, magic: 1 });
  });

  it("教会が設置済みなら山札からマーケットカードを1枚獲得する", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      marketDeck: ["std.oven"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("std.church")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual(["std.oven"]);
    expect(result.value.marketDeck).toEqual([]);
  });

  it("闇市はblackMarketChoicesで選んだ効果を実行する", () => {
    const card = installed("adv.blackMarket");
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [card] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "RESOLVE_TURN_START",
        playerId: "p1",
        blackMarketChoices: { [card.instanceId]: { option: "power", powerType: "magic" } },
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.magic).toBe(1);
  });

  it("闇市の選択が指定されていなければ「market」にフォールバックする（UI未対応の間の暫定挙動）", () => {
    const card = installed("adv.blackMarket");
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      marketDeck: ["std.oven"],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [card] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual(["std.oven"]);
  });

  it("盗賊ギルド：合計5以上のパワーを持つ他プレイヤーがいれば人数分パワーを得る（2人プレイ=3つ）", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.thievesGuild")] }),
        p2: buildTestPlayer("p2", "char.marie", { power: { money: 3, authority: 2, magic: 0 } }),
      },
    });
    const result = applyAction(
      state,
      { type: "RESOLVE_TURN_START", playerId: "p1", characterPowerChoice: "money" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(3);
  });
});

describe("RESOLVE_TURN_START：キャラクター固有能力", () => {
  it("コロネリア：characterPowerChoiceで指定した種類のパワーを1つ得る", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.coronelia"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "RESOLVE_TURN_START", playerId: "p1", characterPowerChoice: "authority" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.authority).toBe(1);
    expect(result.value.dice).toHaveLength(4);
  });

  it("characterPowerChoiceが無ければ「money」にフォールバックする（UI未対応の間の暫定挙動）", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.coronelia"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(1);
  });

  it("ショコラ：パワーを2つ得る", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "RESOLVE_TURN_START", playerId: "p1", characterPowerChoice: "money" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(2);
  });

  it("ソフィ：山札の上から2枚を手札に加える", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      marketDeck: ["std.oven", "std.warehouse", "std.church"],
      players: {
        p1: buildTestPlayer("p1", "char.sophie"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual(["std.oven", "std.warehouse"]);
    expect(result.value.marketDeck).toEqual(["std.church"]);
  });

  it("アン：サイコロパンを2枚獲得する", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      diceBreadDeckCount: 10,
      players: {
        p1: buildTestPlayer("p1", "char.anne"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.diceBreadCards).toHaveLength(2);
    expect(result.value.diceBreadDeckCount).toBe(8);
  });

  it("クロワ：ターン開始時に金を1つ得る", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.croix"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(1);
  });

  it("ロール：ターン開始時に権力を1つ得る", () => {
    const state = buildTestState({
      phase: "turnStart",
      dice: [],
      players: {
        p1: buildTestPlayer("p1", "char.roll"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(state, { type: "RESOLVE_TURN_START", playerId: "p1" }, rng());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.authority).toBe(1);
  });
});

describe("他プレイヤーのダイス出目に反応する条件発動効果", () => {
  it("二ツ星のブレスレット所持者は、他プレイヤーが出目2を出すとPendingChoiceが積まれる（即時付与ではない）", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.twoStarBracelet")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const next = applyOtherPlayersDiceRollTrigger(state, "p2", [2, 2, 5]);
    expect(next.players.p1!.power.authority).toBe(0);
    expect(next.players.p1!.power.magic).toBe(0);
    expect(next.pendingChoices).toHaveLength(1);
    expect(next.pendingChoices[0]).toMatchObject({ playerId: "p1", kind: "twoStarBraceletPower" });
  });

  it("出目2が0回なら二ツ星のブレスレットのPendingChoiceは積まれない", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.twoStarBracelet")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const next = applyOtherPlayersDiceRollTrigger(state, "p2", [1, 3, 5]);
    expect(next.pendingChoices).toHaveLength(0);
  });

  it("RESOLVE_PENDING_CHOICEで二ツ星のブレスレットの選択を解決すると、選んだパワー種別が付与される", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.twoStarBracelet")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const triggered = applyOtherPlayersDiceRollTrigger(state, "p2", [2]);
    const choiceId = triggered.pendingChoices[0]!.id;

    const result = applyAction(
      triggered,
      { type: "RESOLVE_PENDING_CHOICE", playerId: "p1", choiceId, powerType: "magic" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.magic).toBeGreaterThan(0);
    expect(result.value.players.p1!.power.authority).toBe(0);
    expect(result.value.pendingChoices).toHaveLength(0);
  });

  it("本人以外はPendingChoiceを解決できない", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.twoStarBracelet")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const triggered = applyOtherPlayersDiceRollTrigger(state, "p2", [2]);
    const choiceId = triggered.pendingChoices[0]!.id;

    const result = applyAction(
      triggered,
      { type: "RESOLVE_PENDING_CHOICE", playerId: "p2", choiceId, powerType: "authority" },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_YOUR_PENDING_CHOICE");
  });
});

describe("パネテリア遊園地：カード種別の選択", () => {
  it("設置すると、時計回りに全プレイヤー分のPendingChoiceが積まれる（即時ランダム獲得ではない）", () => {
    const state = buildTestState({
      openMarket: ["std.oven"],
      marketDeck: ["std.church", "std.warehouse", "std.mixer", "std.lean", "std.rich", "std.fingerTest"],
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["adv.paneteriaAmusementPark"],
          power: { money: 0, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.chocolat"),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "adv.paneteriaAmusementPark", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual([]);
    const kinds = result.value.pendingChoices.map((c) => c.kind);
    expect(kinds).toEqual(["paneteriaCardType", "paneteriaCardType"]);
    expect(result.value.pendingChoices.map((c) => c.playerId)).toEqual(["p1", "p2"]);
  });

  it("RESOLVE_PENDING_CHOICEで選んだ種類のカードを全て獲得できる", () => {
    const state = buildTestState({
      openMarket: ["std.bakery", "std.bakery", "std.tavern"],
      pendingChoices: [{ id: "c1", playerId: "p1", kind: "paneteriaCardType" }],
      players: {
        p1: buildTestPlayer("p1", "char.marie"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "RESOLVE_PENDING_CHOICE", playerId: "p1", choiceId: "c1", cardId: "std.bakery" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual(["std.bakery", "std.bakery"]);
    expect(result.value.openMarket).toEqual(["std.tavern"]);
    expect(result.value.pendingChoices).toHaveLength(0);
  });

  it("場札に無いカードを指定するとCARD_NOT_IN_MARKETで拒否される", () => {
    const state = buildTestState({
      openMarket: ["std.tavern"],
      pendingChoices: [{ id: "c1", playerId: "p1", kind: "paneteriaCardType" }],
    });
    const result = applyAction(
      state,
      { type: "RESOLVE_PENDING_CHOICE", playerId: "p1", choiceId: "c1", cardId: "std.bakery" },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CARD_NOT_IN_MARKET");
  });
});

describe("INSTALL_CARD：即時発動・条件発動・キャラ固有能力", () => {
  it("倉庫を設置すると手札上限がすぐに2枚増える", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", { hand: ["std.warehouse"], handLimit: 6 }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.warehouse", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.handLimit).toBe(8);
  });

  it("マリーは必要ダイス数が1つ少なくて済む", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          hand: ["std.bakery"],
          power: { money: 2, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    // std.bakery のコストは dice:1 だが、マリーなので0でよい
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.bakery", dieIndices: [] },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.installed).toHaveLength(1);
    expect(result.value.dice[0]!.used).toBe(false);
  });

  it("武器商人を設置すると即時に自分3つ・他プレイヤー1つずつパワーを得る", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["adv.armsDealer"],
          power: { money: 2, authority: 2, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "adv.armsDealer", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power).toEqual({ money: 3, authority: 3, magic: 3 });
    expect(result.value.players.p2!.power).toEqual({ money: 1, authority: 1, magic: 1 });
  });

  it("みかじめ騎士団の所有者は、他プレイヤーがマーケットカードを設置するたびにお金を得る", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["std.bakery"],
          power: { money: 2, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie", { installed: [installed("adv.protectionKnights")] }),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      { type: "INSTALL_CARD", playerId: "p1", cardId: "std.bakery", dieIndices: [0] },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p2!.power.money).toBe(3);
  });

  it("フランは同名カードをもう1枚無コストで同時設置できる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.flan", {
          hand: ["std.bakery", "std.bakery"],
          power: { money: 2, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      {
        type: "INSTALL_CARD",
        playerId: "p1",
        cardId: "std.bakery",
        dieIndices: [0],
        flanBonusCopy: true,
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.installed).toHaveLength(2);
    expect(result.value.players.p1!.hand).toEqual([]);
    expect(result.value.players.p1!.victoryPoints).toBe(2);
    expect(result.value.players.p1!.flanBonusUsedThisTurn).toBe(true);
  });

  it("フラン以外はflanBonusCopyを使えない", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          hand: ["std.bakery", "std.bakery"],
          power: { money: 2, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      {
        type: "INSTALL_CARD",
        playerId: "p1",
        cardId: "std.bakery",
        dieIndices: [0],
        flanBonusCopy: true,
      },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FLAN");
  });
});

describe("ACQUIRE_CARD：条件発動効果", () => {
  it("徴税の路地裏の所有者は、他プレイヤーがカードを獲得するたびにお金を得る", () => {
    const state = buildTestState({
      openMarket: ["std.oven"],
      players: {
        p1: buildTestPlayer("p1", "char.marie"),
        p2: buildTestPlayer("p2", "char.marie", { installed: [installed("adv.taxAlley")] }),
      },
      dice: [{ face: 1, used: false }],
    });
    const result = applyAction(
      state,
      { type: "ACQUIRE_CARD", playerId: "p1", dieIndex: 0, source: "openMarket", cardId: "std.oven" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p2!.power.money).toBe(3);
  });
});

describe("USE_INSTALLED_CARD：魔導書・値切りの指輪・闇金庫", () => {
  it("リーンの魔導書：指定したダイスの目を1にする", () => {
    const card = installed("std.lean");
    const state = buildTestState({
      dice: [{ face: 6, used: false }],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [card] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "USE_INSTALLED_CARD", playerId: "p1", instanceId: card.instanceId, targetDieIndex: 0 },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dice[0]!.face).toBe(1);
  });

  it("フィンガーテストの魔導書：目を+1する", () => {
    const card = installed("std.fingerTest");
    const state = buildTestState({
      dice: [{ face: 3, used: false }],
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [card] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "USE_INSTALLED_CARD",
        playerId: "p1",
        instanceId: card.instanceId,
        targetDieIndex: 0,
        fingerTestDelta: 1,
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dice[0]!.face).toBe(4);
  });

  it("値切りの指輪を使うと、次の設置でパワーコストを最大3軽減できる", () => {
    const ring = installed("adv.bargainRing");
    let state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", {
          installed: [ring],
          hand: ["std.bakery"],
          power: { money: 1, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
      dice: [{ face: 1, used: false }],
    });
    const useResult = applyAction(
      state,
      { type: "USE_INSTALLED_CARD", playerId: "p1", instanceId: ring.instanceId },
      rng(),
    );
    expect(useResult.ok).toBe(true);
    if (!useResult.ok) return;
    state = useResult.value;
    expect(state.players.p1!.pendingBargainRingReduction).toBe(3);

    // std.bakery のコストは money:2 だが、所持金は1しかないので軽減無しでは失敗するはず
    const installResult = applyAction(
      state,
      {
        type: "INSTALL_CARD",
        playerId: "p1",
        cardId: "std.bakery",
        dieIndices: [0],
        bargainRingAllocation: { money: 2 },
      },
      rng(),
    );
    expect(installResult.ok).toBe(true);
    if (!installResult.ok) return;
    expect(installResult.value.players.p1!.power.money).toBe(1);
    expect(installResult.value.players.p1!.pendingBargainRingReduction).toBeUndefined();
  });

  it("闇金庫：お金トークンを載せるとVPに反映される", () => {
    const vault = installed("adv.darkVault");
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [vault],
          power: { money: 3, authority: 0, magic: 0 },
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      {
        type: "USE_INSTALLED_CARD",
        playerId: "p1",
        instanceId: vault.instanceId,
        darkVaultTokenCount: 3,
      },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power.money).toBe(0);
    expect(computeTotalVictoryPoints(result.value, "p1")).toBe(3);
  });
});

describe("キャラクター専用アクション", () => {
  it("SOPHIE_DISCARD_FOR_POWER：手札を1枚捨ててパワーを得る", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.sophie", { hand: ["std.oven"] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "SOPHIE_DISCARD_FOR_POWER", playerId: "p1", cardId: "std.oven", powerType: "magic" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.hand).toEqual([]);
    expect(result.value.players.p1!.power.magic).toBe(1);
  });

  it("ソフィ以外はSOPHIE_DISCARD_FOR_POWERを使えない", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["std.oven"] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "SOPHIE_DISCARD_FOR_POWER", playerId: "p1", cardId: "std.oven", powerType: "magic" },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_SOPHIE");
  });

  it("CHOCOLAT_CONVERT_POWER：1:1でパワーを交換する", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.chocolat", { power: { money: 1, authority: 0, magic: 0 } }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "CHOCOLAT_CONVERT_POWER", playerId: "p1", from: "money", to: "magic" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.power).toEqual({ money: 0, authority: 0, magic: 1 });
  });

  it("CROIX_SKIP_TURN_INSTALL：オープンマーケットから無償設置してターンを終える", () => {
    const state = buildTestState({
      phase: "turnStart",
      openMarket: ["std.bakery"],
      players: {
        p1: buildTestPlayer("p1", "char.croix"),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "CROIX_SKIP_TURN_INSTALL", playerId: "p1", cardId: "std.bakery" },
      rng(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players.p1!.installed.map((c) => c.cardId)).toEqual(["std.bakery"]);
    expect(result.value.players.p1!.croixSkipAbilityUsed).toBe(true);
    expect(result.value.currentPlayerIndex).toBe(1);
  });

  it("CROIX_SKIP_TURN_INSTALLはゲーム中1度しか使えない", () => {
    const state = buildTestState({
      phase: "turnStart",
      openMarket: ["std.bakery"],
      players: {
        p1: buildTestPlayer("p1", "char.croix", { croixSkipAbilityUsed: true }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    const result = applyAction(
      state,
      { type: "CROIX_SKIP_TURN_INSTALL", playerId: "p1", cardId: "std.bakery" },
      rng(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CROIX_ABILITY_USED");
  });
});

describe("動的VP計算", () => {
  it("パンの妖精コッペン：設置枚数の2乗のVPになる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [
            installed("adv.breadFairyKoppen"),
            installed("adv.breadFairyKoppen"),
            installed("adv.breadFairyKoppen"),
          ],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    expect(computeTotalVictoryPoints(state, "p1")).toBe(9);
  });

  it("脱法パン屋：基本1VP + パン屋1枚につき2VP", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [installed("adv.blackMarketBakery"), installed("std.bakery"), installed("std.bakery")],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    expect(computeTotalVictoryPoints(state, "p1")).toBe(5);
  });

  it("麗しき女王像：設置済みカードの権力コスト合計4につき1VP（自身の権力コストも含む）", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { installed: [installed("adv.beautifulQueenStatue")] }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });
    // 麗しき女王像自体のコストは authority: 6 → floor(6/4) = 1
    expect(computeTotalVictoryPoints(state, "p1")).toBe(1);
  });
});
