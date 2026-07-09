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

  it("山札・レジェンド山札の中身は伏せられるが枚数は変わらない", () => {
    const state = buildTestState({
      marketDeck: ["std.bakery", "std.tavern", "std.oven"],
      legend1Deck: ["leg1.koppepanShrine"],
      legend2Deck: [],
    });
    const view = getPlayerView(state, "p1");
    expect(view.marketDeck).toHaveLength(3);
    expect(view.marketDeck).not.toContain("std.bakery");
    expect(view.legend1Deck).toHaveLength(1);
    expect(view.legend2Deck).toHaveLength(0);
  });

  it("元のstateを変更しない（純粋関数）", () => {
    const state = buildTestState({
      players: { p1: buildTestPlayer("p1", "char.marie", { hand: ["std.bakery"] }), p2: buildTestPlayer("p2", "char.marie", { hand: ["std.tavern"] }) },
    });
    getPlayerView(state, "p1");
    expect(state.players.p2!.hand).toEqual(["std.tavern"]);
  });
});
