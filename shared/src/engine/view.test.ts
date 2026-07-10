import { describe, expect, it } from "vitest";
import { getPlayerView } from "./view.js";
import { buildTestState, buildTestPlayer } from "./testUtils.js";

describe("getPlayerView", () => {
  it("他プレイヤーの手札は枚数を保ったまま伏せられる", () => {
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", { hand: ["std.bakery", "std.tavern"] }),
        p2: buildTestPlayer("p2", "char.marie", { hand: ["adv.armsDealer"] }),
      },
    });

    const view = getPlayerView(state, "p1");
    expect(view.players.p1!.hand).toEqual(["std.bakery", "std.tavern"]);
    expect(view.players.p2!.hand).toHaveLength(1);
    expect(view.players.p2!.hand[0]).not.toBe("adv.armsDealer");
  });

  it("自分以外のドラフトパケットは伏せられる", () => {
    const state = buildTestState({
      phase: "draft",
      draft: {
        round: 0,
        packets: { p1: ["std.bakery"], p2: ["std.tavern", "std.oven"] },
        pendingPicks: ["p1", "p2"],
      },
    });

    const view = getPlayerView(state, "p1");
    expect(view.draft?.packets.p1).toEqual(["std.bakery"]);
    expect(view.draft?.packets.p2).toHaveLength(2);
    expect(view.draft?.packets.p2).not.toContain("std.tavern");
  });

  it("マーケット山札の中身は伏せられるが枚数は変わらない", () => {
    const state = buildTestState({
      marketDeck: ["std.bakery", "std.tavern", "std.oven"],
    });
    const view = getPlayerView(state, "p1");
    expect(view.marketDeck).toHaveLength(3);
    expect(view.marketDeck).not.toContain("std.bakery");
  });

  it("元のstateを変更しない（純粋関数）", () => {
    const state = buildTestState({
      players: { p1: buildTestPlayer("p1", "char.marie", { hand: ["std.bakery"] }), p2: buildTestPlayer("p2", "char.marie", { hand: ["std.tavern"] }) },
    });
    getPlayerView(state, "p1");
    expect(state.players.p2!.hand).toEqual(["std.tavern"]);
  });

  it("動的VPカードを持つプレイヤーのvictoryPointsは、加算分を含めた合計値になる（自分・他人どちらの視点でも）", () => {
    // 脱法パン屋：基本1VP + パン屋1枚につき2VP。パン屋2枚設置済みなら 1 + 2*2 = 5。
    // 内部の player.victoryPoints（基礎分）自体は0のまま変化しない想定。
    const state = buildTestState({
      players: {
        p1: buildTestPlayer("p1", "char.marie", {
          installed: [
            { instanceId: "i1", cardId: "adv.blackMarketBakery", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i2", cardId: "std.bakery", installedThisTurn: false, usedThisTurn: false },
            { instanceId: "i3", cardId: "std.bakery", installedThisTurn: false, usedThisTurn: false },
          ],
        }),
        p2: buildTestPlayer("p2", "char.marie"),
      },
    });

    const selfView = getPlayerView(state, "p1");
    expect(selfView.players.p1!.victoryPoints).toBe(5);

    const otherView = getPlayerView(state, "p2");
    expect(otherView.players.p1!.victoryPoints).toBe(5);

    // 元のstateの基礎victoryPointsは書き換わっていない
    expect(state.players.p1!.victoryPoints).toBe(0);
  });
});
