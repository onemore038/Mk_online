import type { GameState, PlayerState, InstalledCard, PowerType } from "../types.js";
import { DIE_FACE_TO_POWER } from "../types.js";
import type { GameAction } from "../actions.js";
import type { Rng } from "../rng.js";
import { rollDie, shuffle } from "../rng.js";
import { getCharacter, getMarketCard } from "../cards/index.js";
import { EngineError, NotImplementedError, type EngineResult, ok, fail } from "./errors.js";
import { applyDraftPick } from "./draft.js";
import { refillOpenMarket } from "./market.js";

function currentPlayerId(state: GameState): string {
  return state.playerOrder[state.currentPlayerIndex]!;
}

function requirePlayer(state: GameState, playerId: string): EngineResult<PlayerState> {
  const player = state.players[playerId];
  if (!player) return fail(new EngineError("不明なプレイヤーです", "UNKNOWN_PLAYER"));
  return ok(player);
}

function requireCurrentPlayerTurn(
  state: GameState,
  playerId: string,
  expectedPhase: GameState["phase"],
): EngineResult<void> {
  if (state.phase !== expectedPhase) {
    return fail(
      new EngineError(
        `現在のフェイズ（${state.phase}）ではこの操作はできません`,
        "WRONG_PHASE",
      ),
    );
  }
  if (currentPlayerId(state) !== playerId) {
    return fail(new EngineError("あなたの手番ではありません", "NOT_YOUR_TURN"));
  }
  return ok(undefined);
}

function payPower(
  power: Record<PowerType, number>,
  cost: Partial<Record<PowerType, number>>,
): EngineResult<Record<PowerType, number>> {
  const next = { ...power };
  for (const [type, amount] of Object.entries(cost) as [PowerType, number][]) {
    if ((next[type] ?? 0) < amount) {
      return fail(
        new EngineError(`パワー（${type}）が不足しています`, "INSUFFICIENT_POWER"),
      );
    }
    next[type] -= amount;
  }
  return ok(next);
}

function markDiceUsed(state: GameState, dieIndices: number[]): EngineResult<GameState["dice"]> {
  const dice = state.dice.map((d) => ({ ...d }));
  for (const idx of dieIndices) {
    const die = dice[idx];
    if (!die) return fail(new EngineError(`存在しないダイス番号です: ${idx}`, "INVALID_DIE_INDEX"));
    if (die.used) return fail(new EngineError(`ダイス${idx}は既に使用済みです`, "DIE_ALREADY_USED"));
    die.used = true;
  }
  return ok(dice);
}

/** applyAction のメインエントリポイント。純粋関数（同じ入力なら同じ出力）。乱数のみ Rng 経由で注入する。 */
export function applyAction(
  state: GameState,
  action: GameAction,
  rng: Rng,
): EngineResult<GameState> {
  switch (action.type) {
    case "DRAFT_PICK":
      return applyDraftPick(state, action, rng);

    case "RESOLVE_TURN_START":
      return resolveTurnStart(state, action.playerId, rng);

    case "ACQUIRE_CARD":
      return acquireCard(state, action, rng);

    case "INSTALL_CARD":
      return installCard(state, action);

    case "USE_INSTALLED_CARD":
      return useInstalledCard(state, action);

    case "PLACE_LEGEND_CARD":
      return placeLegendCard(state, action);

    case "REFRESH_MARKET":
      return refreshMarket(state, action, rng);

    case "GAIN_POWER":
      return gainPower(state, action);

    case "CONVERT_POWER":
      return convertPower(state, action);

    case "DISCARD_TO_HAND_LIMIT":
      return discardToHandLimit(state, action);

    case "END_TURN":
      return endTurn(state, action, rng);
  }
}

function resolveTurnStart(state: GameState, playerId: string, rng: Rng): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, playerId, "turnStart");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, playerId);
  if (!playerResult.ok) return playerResult;

  const character = getCharacter(playerResult.value.characterId);
  const dice = Array.from({ length: character.diceCount }, () => ({
    face: rollDie(rng),
    used: false,
  }));

  return ok({
    ...state,
    phase: "turnActions",
    dice,
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId,
        type: "TURN_START",
        detail: `ダイス${character.diceCount}個を振りました`,
      },
    ],
  });
}

function acquireCard(
  state: GameState,
  action: Extract<GameAction, { type: "ACQUIRE_CARD" }>,
  rng: Rng,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;

  const diceResult = markDiceUsed(state, [action.dieIndex]);
  if (!diceResult.ok) return diceResult;

  let openMarket = state.openMarket;
  let marketDeck = [...state.marketDeck];
  let marketDiscard = [...state.marketDiscard];
  let acquiredCardIds: string[];

  if (action.source === "openMarket") {
    if (!openMarket.includes(action.cardId)) {
      return fail(
        new EngineError("指定されたカードは場札にありません", "CARD_NOT_IN_MARKET"),
      );
    }
    // 同名カードが場に複数枚あれば全て獲得する
    acquiredCardIds = openMarket.filter((id) => id === action.cardId);
    openMarket = openMarket.filter((id) => id !== action.cardId);
  } else {
    if (marketDeck.length === 0) {
      if (marketDiscard.length === 0) {
        return fail(new EngineError("山札にカードが残っていません", "DECK_EMPTY"));
      }
      marketDeck = shuffle(marketDiscard, rng);
      marketDiscard = [];
    }
    const drawn = marketDeck.shift()!;
    acquiredCardIds = [drawn];
  }

  const player = playerResult.value;
  return ok({
    ...state,
    dice: diceResult.value,
    openMarket,
    marketDeck,
    marketDiscard,
    players: {
      ...state.players,
      [action.playerId]: { ...player, hand: [...player.hand, ...acquiredCardIds] },
    },
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "ACQUIRE_CARD",
        detail: `${acquiredCardIds.join(", ")} を獲得しました`,
      },
    ],
  });
}

function installCard(
  state: GameState,
  action: Extract<GameAction, { type: "INSTALL_CARD" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (!player.hand.includes(action.cardId)) {
    return fail(new EngineError("そのカードは手札にありません", "CARD_NOT_IN_HAND"));
  }

  const card = getMarketCard(action.cardId);
  if (card.cost === null) {
    return fail(
      new NotImplementedError(
        `「${card.name}」の設置コストは未確認のため、まだ設置を実装できません（shared/src/cards/README.md 参照）`,
      ),
    );
  }

  const requiredDice = card.cost.dice ?? 0;
  if (action.dieIndices.length !== requiredDice) {
    return fail(
      new EngineError(
        `必要なダイス数が一致しません（必要: ${requiredDice}, 指定: ${action.dieIndices.length}）`,
        "DICE_COUNT_MISMATCH",
      ),
    );
  }
  const diceResult = markDiceUsed(state, action.dieIndices);
  if (!diceResult.ok) return diceResult;

  const powerCost: Partial<Record<PowerType, number>> = {
    money: card.cost.money ?? 0,
    authority: card.cost.authority ?? 0,
    magic: card.cost.magic ?? 0,
  };
  const powerResult = payPower(player.power, powerCost);
  if (!powerResult.ok) return powerResult;

  const newHand = [...player.hand];
  newHand.splice(newHand.indexOf(action.cardId), 1);

  const installed: InstalledCard = {
    instanceId: crypto.randomUUID(),
    cardId: action.cardId,
    installedThisTurn: true,
    usedThisTurn: false,
  };

  const newVictoryPoints = player.victoryPoints + (card.victoryPoints ?? 0);

  return ok({
    ...state,
    dice: diceResult.value,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        power: powerResult.value,
        hand: newHand,
        installed: [...player.installed, installed],
        victoryPoints: newVictoryPoints,
      },
    },
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "INSTALL_CARD",
        detail: `${card.name} を設置しました`,
      },
    ],
  });
}

function useInstalledCard(
  state: GameState,
  action: Extract<GameAction, { type: "USE_INSTALLED_CARD" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  const target = player.installed.find((c) => c.instanceId === action.instanceId);
  if (!target) {
    return fail(new EngineError("指定された設置済みカードが見つかりません", "CARD_NOT_FOUND"));
  }
  if (target.installedThisTurn) {
    return fail(
      new EngineError("このターンに設置したカードはまだ使用できません", "JUST_INSTALLED"),
    );
  }
  if (target.usedThisTurn) {
    return fail(new EngineError("このカードは今ターン既に使用済みです", "ALREADY_USED"));
  }

  const card = getMarketCard(target.cardId);
  if (!card.hasProgrammaticEffect) {
    return fail(
      new NotImplementedError(
        `「${card.name}」の効果はまだ実装されていません: ${card.effectSummary}`,
      ),
    );
  }

  // TODO: ここで実際のカード効果（未実装）を state に適用する
  const newInstalled = player.installed.map((c) =>
    c.instanceId === action.instanceId ? { ...c, usedThisTurn: true } : c,
  );

  return ok({
    ...state,
    players: {
      ...state.players,
      [action.playerId]: { ...player, installed: newInstalled },
    },
  });
}

function placeLegendCard(
  state: GameState,
  action: Extract<GameAction, { type: "PLACE_LEGEND_CARD" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (state.legendPlacedThisTurn) {
    return fail(
      new EngineError("レジェンドカードの設置は1ターンに1回までです", "LEGEND_LIMIT"),
    );
  }

  const row = action.row === "legend1" ? state.legend1Row : state.legend2Row;
  if (!row.includes(action.cardId)) {
    return fail(new EngineError("指定されたレジェンドカードは場にありません", "CARD_NOT_IN_ROW"));
  }

  const card = getMarketCard(action.cardId);
  if (card.cost === null) {
    return fail(
      new NotImplementedError(
        `「${card.name}」の設置条件は未確認のため、まだ設置を実装できません（shared/src/cards/README.md 参照）`,
      ),
    );
  }

  const requiredDice = card.cost.dice ?? 0;
  if (action.dieIndices.length !== requiredDice) {
    return fail(
      new EngineError("必要なダイス数が一致しません", "DICE_COUNT_MISMATCH"),
    );
  }
  const diceResult = markDiceUsed(state, action.dieIndices);
  if (!diceResult.ok) return diceResult;

  const powerCost: Partial<Record<PowerType, number>> = {
    money: card.cost.money ?? 0,
    authority: card.cost.authority ?? 0,
    magic: card.cost.magic ?? 0,
  };
  const powerResult = payPower(player.power, powerCost);
  if (!powerResult.ok) return powerResult;

  const installed: InstalledCard = {
    instanceId: crypto.randomUUID(),
    cardId: action.cardId,
    installedThisTurn: true,
    usedThisTurn: false,
  };

  const isRow1 = action.row === "legend1";
  const newRow = row.filter((id) => id !== action.cardId);
  // 補充：対応する山札から1枚引いて列に戻す（要確認: legend1/legend2 補充ルールの詳細は
  // 物理版レイアウトを確認できていないため、対称的な暫定実装にしている）
  const deck = isRow1 ? [...state.legend1Deck] : [...state.legend2Deck];
  const drawn = deck.shift();
  const replenishedRow = drawn ? [...newRow, drawn] : newRow;

  return ok({
    ...state,
    dice: diceResult.value,
    legend1Row: isRow1 ? replenishedRow : state.legend1Row,
    legend1Deck: isRow1 ? deck : state.legend1Deck,
    legend2Row: isRow1 ? state.legend2Row : replenishedRow,
    legend2Deck: isRow1 ? state.legend2Deck : deck,
    legendPlacedThisTurn: true,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        power: powerResult.value,
        installed: [...player.installed, installed],
        victoryPoints: player.victoryPoints + (card.victoryPoints ?? 0),
      },
    },
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "PLACE_LEGEND_CARD",
        detail: `${card.name} を設置しました`,
      },
    ],
  });
}

function refreshMarket(
  state: GameState,
  action: Extract<GameAction, { type: "REFRESH_MARKET" }>,
  rng: Rng,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  const powerResult = payPower(player.power, { money: 1, authority: 1, magic: 1 });
  if (!powerResult.ok) return powerResult;

  const cleared: GameState = {
    ...state,
    players: { ...state.players, [action.playerId]: { ...player, power: powerResult.value } },
    marketDiscard: [...state.marketDiscard, ...state.openMarket],
    openMarket: [],
  };

  const refilled = refillOpenMarket(cleared, rng);
  return ok({
    ...refilled,
    log: [
      ...refilled.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "REFRESH_MARKET",
        detail: "オープンマーケットを入れ替えました",
      },
    ],
  });
}

function gainPower(
  state: GameState,
  action: Extract<GameAction, { type: "GAIN_POWER" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  let powerType: PowerType;
  let dice = state.dice;
  let diceBreadCards = player.diceBreadCards;
  let diceBreadDiscardCount = state.diceBreadDiscardCount;

  if (action.source.kind === "die") {
    const diceResult = markDiceUsed(state, [action.source.dieIndex]);
    if (!diceResult.ok) return diceResult;
    dice = diceResult.value;
    powerType = DIE_FACE_TO_POWER[dice[action.source.dieIndex]!.face];
  } else {
    if (diceBreadCards < 1) {
      return fail(new EngineError("サイコロパンカードを持っていません", "NO_DICE_BREAD"));
    }
    diceBreadCards -= 1;
    diceBreadDiscardCount += 1;
    powerType = action.source.powerType;
  }

  const newPower = { ...player.power, [powerType]: player.power[powerType] + 1 };

  return ok({
    ...state,
    dice,
    diceBreadDiscardCount,
    players: {
      ...state.players,
      [action.playerId]: { ...player, power: newPower, diceBreadCards },
    },
  });
}

function convertPower(
  state: GameState,
  action: Extract<GameAction, { type: "CONVERT_POWER" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (action.from === action.to) {
    return fail(new EngineError("変換元と変換先が同じです", "SAME_POWER_TYPE"));
  }
  const powerResult = payPower(player.power, { [action.from]: 2 } as Partial<
    Record<PowerType, number>
  >);
  if (!powerResult.ok) return powerResult;

  const newPower = { ...powerResult.value, [action.to]: powerResult.value[action.to] + 1 };

  return ok({
    ...state,
    players: { ...state.players, [action.playerId]: { ...player, power: newPower } },
  });
}

function discardToHandLimit(
  state: GameState,
  action: Extract<GameAction, { type: "DISCARD_TO_HAND_LIMIT" }>,
): EngineResult<GameState> {
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  const newHand = [...player.hand];
  for (const cardId of action.cardIds) {
    const idx = newHand.indexOf(cardId);
    if (idx === -1) {
      return fail(
        new EngineError(`手札にないカードを捨てようとしました: ${cardId}`, "CARD_NOT_IN_HAND"),
      );
    }
    newHand.splice(idx, 1);
  }
  if (newHand.length > player.handLimit) {
    return fail(
      new EngineError(
        `まだ手札上限（${player.handLimit}枚）を超えています`,
        "STILL_OVER_HAND_LIMIT",
      ),
    );
  }

  return ok({
    ...state,
    marketDiscard: [...state.marketDiscard, ...action.cardIds],
    players: { ...state.players, [action.playerId]: { ...player, hand: newHand } },
  });
}

function endTurn(
  state: GameState,
  action: Extract<GameAction, { type: "END_TURN" }>,
  rng: Rng,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (player.hand.length > player.handLimit) {
    return fail(
      new EngineError(
        `手札上限（${player.handLimit}枚）を超えています。先に DISCARD_TO_HAND_LIMIT を行ってください`,
        "MUST_DISCARD_FIRST",
      ),
    );
  }

  // このプレイヤーの設置済みカードの「設置中」「使用済み」フラグをリセットする
  const resetInstalled = player.installed.map((c) => ({
    ...c,
    installedThisTurn: false,
    usedThisTurn: false,
  }));

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.playerId]: { ...player, installed: resetInstalled },
    },
    legendPlacedThisTurn: false,
  };
  next = refillOpenMarket(next, rng);

  // 20VP到達チェック（本来はVPが変化した瞬間に判定すべきだが、保険としてターン終了時にも確認する）
  if (next.finalRoundTriggeredBy === null) {
    const trigger = next.playerOrder.find((id) => next.players[id]!.victoryPoints >= 20);
    if (trigger) {
      next = {
        ...next,
        finalRoundTriggeredBy: trigger,
        log: [
          ...next.log,
          {
            turn: next.turnNumber,
            playerId: trigger,
            type: "FINAL_ROUND_TRIGGERED",
            detail: "20VPに到達しました。他のプレイヤーが1周した後にゲーム終了します",
          },
        ],
      };
    }
  }

  const n = next.playerOrder.length;
  const nextIndex = (next.currentPlayerIndex + 1) % n;
  const nextPlayerId = next.playerOrder[nextIndex]!;

  if (next.finalRoundTriggeredBy !== null && nextPlayerId === next.finalRoundTriggeredBy) {
    return ok(finishGame(next));
  }

  return ok({
    ...next,
    currentPlayerIndex: nextIndex,
    phase: "turnStart",
    dice: [],
    turnNumber: next.turnNumber + 1,
    log: [
      ...next.log,
      { turn: next.turnNumber, playerId: action.playerId, type: "END_TURN", detail: "ターン終了" },
    ],
  });
}

function finishGame(state: GameState): GameState {
  let bestVp = -Infinity;
  for (const id of state.playerOrder) {
    bestVp = Math.max(bestVp, state.players[id]!.victoryPoints);
  }
  let vpTied = state.playerOrder.filter((id) => state.players[id]!.victoryPoints === bestVp);

  let winnerIds = vpTied;
  if (vpTied.length > 1) {
    let bestCardCount = -Infinity;
    for (const id of vpTied) {
      bestCardCount = Math.max(bestCardCount, state.players[id]!.installed.length);
    }
    winnerIds = vpTied.filter((id) => state.players[id]!.installed.length === bestCardCount);
  }

  return {
    ...state,
    phase: "gameOver",
    winnerIds,
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: null,
        type: "GAME_OVER",
        detail: `ゲーム終了。勝者: ${winnerIds.join(", ")}`,
      },
    ],
  };
}
