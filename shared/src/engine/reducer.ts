import type {
  GameState,
  PlayerState,
  InstalledCard,
  PowerType,
  RequiredDiscard,
} from "../types.js";
import { DIE_FACE_TO_POWER } from "../types.js";
import type { GameAction } from "../actions.js";
import type { Rng } from "../rng.js";
import { rollDie, shuffle } from "../rng.js";
import { getCharacter, getMarketCard } from "../cards/index.js";
import { EngineError, NotImplementedError, type EngineResult, ok, fail } from "./errors.js";
import { applyDraftPick } from "./draft.js";
import { refillOpenMarket } from "./market.js";
import { diceFacesSatisfyGroups } from "./diceFaceMatching.js";
import {
  applyTurnStartEffects,
  applyInstallImmediateEffect,
  applyOtherPlayersInstallTrigger,
  applyOtherPlayersAcquireTrigger,
  applyOtherPlayersDiceRollTrigger,
  applyOtherPlayersDiceBreadGainTrigger,
  computeTotalVictoryPoints,
} from "./cardEffects.js";

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

/**
 * 「特定カードを手札／設置済みカードから指定枚数捨てる」コストを支払う。
 * 同名カードは区別しないため、どのインスタンスを捨てるかは自動的に決まる。
 */
function payRequiredDiscards(
  player: PlayerState,
  requiredDiscards: readonly RequiredDiscard[],
): EngineResult<{ hand: string[]; installed: InstalledCard[]; discardedCardIds: string[] }> {
  let hand = [...player.hand];
  let installed = [...player.installed];
  const discardedCardIds: string[] = [];

  for (const req of requiredDiscards) {
    if (req.from === "hand") {
      const owned = hand.filter((id) => id === req.cardId).length;
      if (owned < req.count) {
        return fail(
          new EngineError(
            `手札の「${req.cardId}」が不足しています（必要: ${req.count}, 所持: ${owned}）`,
            "INSUFFICIENT_DISCARD_MATERIAL",
          ),
        );
      }
      let remaining = req.count;
      hand = hand.filter((id) => {
        if (remaining > 0 && id === req.cardId) {
          remaining -= 1;
          discardedCardIds.push(id);
          return false;
        }
        return true;
      });
    } else {
      const owned = installed.filter((c) => c.cardId === req.cardId).length;
      if (owned < req.count) {
        return fail(
          new EngineError(
            `設置済みの「${req.cardId}」が不足しています（必要: ${req.count}, 所持: ${owned}）`,
            "INSUFFICIENT_DISCARD_MATERIAL",
          ),
        );
      }
      let remaining = req.count;
      installed = installed.filter((c) => {
        if (remaining > 0 && c.cardId === req.cardId) {
          remaining -= 1;
          discardedCardIds.push(c.cardId);
          return false;
        }
        return true;
      });
    }
  }

  return ok({ hand, installed, discardedCardIds });
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
      return resolveTurnStart(state, action, rng);

    case "ACQUIRE_CARD":
      return acquireCard(state, action, rng);

    case "INSTALL_CARD":
      return installCard(state, action, rng);

    case "USE_INSTALLED_CARD":
      return useInstalledCard(state, action, rng);

    case "PLACE_LEGEND_CARD":
      return placeLegendCard(state, action);

    case "REFRESH_MARKET":
      return refreshMarket(state, action, rng);

    case "GAIN_POWER":
      return gainPower(state, action);

    case "CONVERT_POWER":
      return convertPower(state, action);

    case "SOPHIE_DISCARD_FOR_POWER":
      return sophieDiscardForPower(state, action);

    case "CHOCOLAT_CONVERT_POWER":
      return chocolatConvertPower(state, action);

    case "CROIX_SKIP_TURN_INSTALL":
      return croixSkipTurnInstall(state, action, rng);

    case "RESOLVE_PENDING_CHOICE":
      return resolvePendingChoice(state, action);

    case "DISCARD_TO_HAND_LIMIT":
      return discardToHandLimit(state, action);

    case "END_TURN":
      return endTurn(state, action, rng);
  }
}

function resolveTurnStart(
  state: GameState,
  action: Extract<GameAction, { type: "RESOLVE_TURN_START" }>,
  rng: Rng,
): EngineResult<GameState> {
  const playerId = action.playerId;
  const turnCheck = requireCurrentPlayerTurn(state, playerId, "turnStart");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, playerId);
  if (!playerResult.ok) return playerResult;

  const character = getCharacter(playerResult.value.characterId);
  const dice = Array.from({ length: character.diceCount }, () => ({
    face: rollDie(rng),
    used: false,
  }));

  let next: GameState = {
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
  };

  // 二ツ星のブレスレット・五ツ星のネックレス：他プレイヤーが所持している場合、
  // 今振ったダイスの出目（2 or 5）を見て条件発動する。
  next = applyOtherPlayersDiceRollTrigger(
    next,
    playerId,
    dice.map((d) => d.face),
  );

  const diceBreadBefore = next.players[playerId]!.diceBreadCards.length;
  const effectsResult = applyTurnStartEffects(next, playerId, rng, action);
  if (!effectsResult.ok) return effectsResult;
  next = effectsResult.value;

  // 王立パン協会：他プレイヤーがサイコロパンカードを獲得するたびに発動する
  const diceBreadGained = next.players[playerId]!.diceBreadCards.length - diceBreadBefore;
  next = applyOtherPlayersDiceBreadGainTrigger(next, playerId, diceBreadGained);

  return ok(next);
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
  let next: GameState = {
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
  };

  next = applyOtherPlayersAcquireTrigger(next, action.playerId);

  return ok(next);
}

/** 値切りの指輪の未消費軽減分を、指定された配分でパワーコストに適用する。 */
function applyBargainRingAllocation(
  player: PlayerState,
  powerCost: Record<PowerType, number>,
  allocation: Partial<Record<PowerType, number>> | undefined,
): EngineResult<Record<PowerType, number>> {
  if (!allocation) return ok(powerCost);
  const available = player.pendingBargainRingReduction ?? 0;
  if (available <= 0) {
    return fail(
      new EngineError("値切りの指輪の未消費の軽減がありません", "NO_BARGAIN_RING_REDUCTION"),
    );
  }
  let totalAllocated = 0;
  const next = { ...powerCost };
  for (const [type, amount] of Object.entries(allocation) as [PowerType, number | undefined][]) {
    if (!amount) continue;
    if (amount > next[type]) {
      return fail(
        new EngineError(
          `「${type}」の軽減指定がコストを超えています`,
          "INVALID_BARGAIN_RING_ALLOCATION",
        ),
      );
    }
    next[type] -= amount;
    totalAllocated += amount;
  }
  if (totalAllocated > available) {
    return fail(
      new EngineError("値切りの指輪の軽減残量を超えています", "INVALID_BARGAIN_RING_ALLOCATION"),
    );
  }
  return ok(next);
}

function installCard(
  state: GameState,
  action: Extract<GameAction, { type: "INSTALL_CARD" }>,
  rng: Rng,
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

  // マリーの常時発動能力：必要サイコロ数を1つ不要にできる
  const marieDiscount = player.characterId === "char.marie" ? 1 : 0;
  const requiredDice = Math.max(0, (card.cost.dice ?? 0) - marieDiscount);
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

  const selectedFaces = action.dieIndices.map((idx) => state.dice[idx]!.face);
  if (!diceFacesSatisfyGroups(selectedFaces, card.cost.diceFaceGroups)) {
    return fail(
      new EngineError("選択したダイスの出目が設置条件を満たしていません", "DICE_FACE_MISMATCH"),
    );
  }

  const baseCost: Record<PowerType, number> = {
    money: card.cost.money ?? 0,
    authority: card.cost.authority ?? 0,
    magic: card.cost.magic ?? 0,
  };
  const allocationResult = applyBargainRingAllocation(player, baseCost, action.bargainRingAllocation);
  if (!allocationResult.ok) return allocationResult;
  const powerCost = allocationResult.value;
  const bargainRingUsed = action.bargainRingAllocation !== undefined;

  const powerResult = payPower(player.power, powerCost);
  if (!powerResult.ok) return powerResult;

  const newHand = [...player.hand];
  newHand.splice(newHand.indexOf(action.cardId), 1);

  // フランの固有能力：手札にある同名カードをもう1枚、無コストで同時設置する
  let flanBonusUsedThisTurn = player.flanBonusUsedThisTurn ?? false;
  const installedCards: InstalledCard[] = [
    { instanceId: crypto.randomUUID(), cardId: action.cardId, installedThisTurn: true, usedThisTurn: false },
  ];
  let bonusVictoryPoints = 0;
  if (action.flanBonusCopy) {
    if (player.characterId !== "char.flan") {
      return fail(new EngineError("この能力はフランのみ使用できます", "NOT_FLAN"));
    }
    if (flanBonusUsedThisTurn) {
      return fail(new EngineError("フランの能力は1ターンに1回までです", "FLAN_BONUS_LIMIT"));
    }
    const secondIdx = newHand.indexOf(action.cardId);
    if (secondIdx === -1) {
      return fail(
        new EngineError("同名のカードが手札にもう1枚ありません", "NO_SECOND_COPY_IN_HAND"),
      );
    }
    newHand.splice(secondIdx, 1);
    installedCards.push({
      instanceId: crypto.randomUUID(),
      cardId: action.cardId,
      installedThisTurn: true,
      usedThisTurn: false,
    });
    bonusVictoryPoints = card.victoryPoints ?? 0;
    flanBonusUsedThisTurn = true;
  }

  const newHandLimit =
    action.cardId === "std.warehouse" ? player.handLimit + 2 : player.handLimit;

  const newVictoryPoints = player.victoryPoints + (card.victoryPoints ?? 0) + bonusVictoryPoints;

  let next: GameState = {
    ...state,
    dice: diceResult.value,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        power: powerResult.value,
        hand: newHand,
        handLimit: newHandLimit,
        installed: [...player.installed, ...installedCards],
        victoryPoints: newVictoryPoints,
        pendingBargainRingReduction: bargainRingUsed ? undefined : player.pendingBargainRingReduction,
        flanBonusUsedThisTurn,
      },
    },
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "INSTALL_CARD",
        detail: `${card.name} を設置しました${installedCards.length > 1 ? "（フランの能力で2枚）" : ""}`,
      },
    ],
  };

  for (const inst of installedCards) {
    next = applyInstallImmediateEffect(next, action.playerId, inst.cardId, rng);
    next = applyOtherPlayersInstallTrigger(next, action.playerId);
  }

  return ok(next);
}

function useInstalledCard(
  state: GameState,
  action: Extract<GameAction, { type: "USE_INSTALLED_CARD" }>,
  rng: Rng,
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

  const markUsed = (installed: InstalledCard[]): InstalledCard[] =>
    installed.map((c) => (c.instanceId === action.instanceId ? { ...c, usedThisTurn: true } : c));

  switch (target.cardId) {
    case "std.lean":
    case "std.rich": {
      const targetFace = target.cardId === "std.lean" ? 1 : 6;
      const dieIdx = action.targetDieIndex;
      if (dieIdx === undefined) {
        return fail(new EngineError("targetDieIndex が必要です", "MISSING_TARGET_DIE"));
      }
      const die = state.dice[dieIdx];
      if (!die) return fail(new EngineError(`存在しないダイス番号です: ${dieIdx}`, "INVALID_DIE_INDEX"));
      if (die.used) return fail(new EngineError("使用済みのダイスは変更できません", "DIE_ALREADY_USED"));
      const newDice = state.dice.map((d, i) => (i === dieIdx ? { ...d, face: targetFace as typeof d.face } : d));
      return ok({
        ...state,
        dice: newDice,
        players: {
          ...state.players,
          [action.playerId]: { ...player, installed: markUsed(player.installed) },
        },
      });
    }
    case "std.fingerTest": {
      const dieIdx = action.targetDieIndex;
      const delta = action.fingerTestDelta;
      if (dieIdx === undefined || delta === undefined) {
        return fail(
          new EngineError("targetDieIndex と fingerTestDelta が必要です", "MISSING_TARGET_DIE"),
        );
      }
      const die = state.dice[dieIdx];
      if (!die) return fail(new EngineError(`存在しないダイス番号です: ${dieIdx}`, "INVALID_DIE_INDEX"));
      if (die.used) return fail(new EngineError("使用済みのダイスは変更できません", "DIE_ALREADY_USED"));
      const newFace = die.face + delta;
      if (newFace < 1 || newFace > 6) {
        return fail(new EngineError("出目が1〜6の範囲を超えます", "INVALID_DIE_FACE"));
      }
      const newDice = state.dice.map((d, i) => (i === dieIdx ? { ...d, face: newFace as typeof d.face } : d));
      return ok({
        ...state,
        dice: newDice,
        players: {
          ...state.players,
          [action.playerId]: { ...player, installed: markUsed(player.installed) },
        },
      });
    }
    case "std.mixer": {
      const indices = action.rerollDieIndices ?? [];
      const seen = new Set<number>();
      for (const idx of indices) {
        const die = state.dice[idx];
        if (!die) return fail(new EngineError(`存在しないダイス番号です: ${idx}`, "INVALID_DIE_INDEX"));
        if (die.used) return fail(new EngineError("使用済みのダイスは変更できません", "DIE_ALREADY_USED"));
        if (seen.has(idx)) return fail(new EngineError(`ダイス番号が重複しています: ${idx}`, "INVALID_DIE_INDEX"));
        seen.add(idx);
      }
      const newDice = state.dice.map((d, i) => (seen.has(i) ? { ...d, face: rollDie(rng) } : d));
      return ok({
        ...state,
        dice: newDice,
        players: {
          ...state.players,
          [action.playerId]: { ...player, installed: markUsed(player.installed) },
        },
      });
    }
    case "adv.bargainRing": {
      return ok({
        ...state,
        players: {
          ...state.players,
          [action.playerId]: {
            ...player,
            installed: markUsed(player.installed),
            pendingBargainRingReduction: 3,
          },
        },
      });
    }
    case "adv.darkVault": {
      const count = action.darkVaultTokenCount;
      if (count === undefined || count < 1 || count > 3) {
        return fail(
          new EngineError("darkVaultTokenCount は1〜3で指定してください", "INVALID_TOKEN_COUNT"),
        );
      }
      const powerResult = payPower(player.power, { money: count });
      if (!powerResult.ok) return powerResult;
      const newInstalled = markUsed(player.installed).map((c) =>
        c.instanceId === action.instanceId ? { ...c, tokens: (c.tokens ?? 0) + count } : c,
      );
      return ok({
        ...state,
        players: {
          ...state.players,
          [action.playerId]: { ...player, power: powerResult.value, installed: newInstalled },
        },
      });
    }
    default:
      return fail(
        new NotImplementedError(`「${card.name}」の使用効果はまだ実装されていません`),
      );
  }
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

  let diceResultValue = state.dice;
  let diceBreadCardsAfterPipSum = player.diceBreadCards;
  let pipSumDiceBreadSpent = 0;

  if (card.cost.requiredPipSum !== undefined) {
    // 出目合計コスト（無限鏡の大迷宮など）：dieIndices はこのターンに振ったダイス、
    // diceBreadIndices は所持サイコロパンのうち、出目合計に充てるものを指す。cost.dice は使わない。
    const dieIndices = action.dieIndices;
    const diceBreadIndices = action.diceBreadIndices ?? [];

    const seenDice = new Set<number>();
    for (const idx of dieIndices) {
      const die = state.dice[idx];
      if (!die) return fail(new EngineError(`存在しないダイス番号です: ${idx}`, "INVALID_DIE_INDEX"));
      if (die.used) return fail(new EngineError(`ダイス${idx}は使用済みです`, "DIE_ALREADY_USED"));
      if (seenDice.has(idx)) {
        return fail(new EngineError(`ダイス番号が重複しています: ${idx}`, "INVALID_DIE_INDEX"));
      }
      seenDice.add(idx);
    }
    const seenBread = new Set<number>();
    for (const idx of diceBreadIndices) {
      const face = player.diceBreadCards[idx];
      if (face === undefined) {
        return fail(
          new EngineError(`存在しないサイコロパン番号です: ${idx}`, "INVALID_DICE_BREAD_INDEX"),
        );
      }
      if (seenBread.has(idx)) {
        return fail(
          new EngineError(`サイコロパン番号が重複しています: ${idx}`, "INVALID_DICE_BREAD_INDEX"),
        );
      }
      seenBread.add(idx);
    }

    const pipSum =
      dieIndices.reduce((sum, idx) => sum + state.dice[idx]!.face, 0) +
      diceBreadIndices.reduce((sum, idx) => sum + player.diceBreadCards[idx]!, 0);
    if (pipSum < card.cost.requiredPipSum) {
      return fail(
        new EngineError(
          `出目の合計が足りません（必要: ${card.cost.requiredPipSum}以上, 指定分の合計: ${pipSum}）`,
          "INSUFFICIENT_PIP_SUM",
        ),
      );
    }

    const diceMarkResult = markDiceUsed(state, dieIndices);
    if (!diceMarkResult.ok) return diceMarkResult;
    diceResultValue = diceMarkResult.value;
    diceBreadCardsAfterPipSum = player.diceBreadCards.filter((_, idx) => !seenBread.has(idx));
    pipSumDiceBreadSpent = diceBreadIndices.length;
  } else {
    // マリーの常時発動能力：必要サイコロ数を1つ不要にできる
    const marieDiscount = player.characterId === "char.marie" ? 1 : 0;
    const requiredDice = Math.max(0, (card.cost.dice ?? 0) - marieDiscount);
    if (action.dieIndices.length !== requiredDice) {
      return fail(new EngineError("必要なダイス数が一致しません", "DICE_COUNT_MISMATCH"));
    }
    const diceMarkResult = markDiceUsed(state, action.dieIndices);
    if (!diceMarkResult.ok) return diceMarkResult;
    diceResultValue = diceMarkResult.value;

    const selectedFaces = action.dieIndices.map((idx) => state.dice[idx]!.face);
    if (!diceFacesSatisfyGroups(selectedFaces, card.cost.diceFaceGroups)) {
      return fail(
        new EngineError("選択したダイスの出目が設置条件を満たしていません", "DICE_FACE_MISMATCH"),
      );
    }
  }

  const baseCost: Record<PowerType, number> = {
    money: card.cost.money ?? 0,
    authority: card.cost.authority ?? 0,
    magic: card.cost.magic ?? 0,
  };
  const allocationResult = applyBargainRingAllocation(player, baseCost, action.bargainRingAllocation);
  if (!allocationResult.ok) return allocationResult;
  const powerCost = allocationResult.value;
  const bargainRingUsed = action.bargainRingAllocation !== undefined;

  const powerResult = payPower(player.power, powerCost);
  if (!powerResult.ok) return powerResult;

  let handAfterDiscards = player.hand;
  let installedAfterDiscards = player.installed;
  let discardedCardIds: string[] = [];
  if (card.cost.requiredDiscards && card.cost.requiredDiscards.length > 0) {
    const discardResult = payRequiredDiscards(player, card.cost.requiredDiscards);
    if (!discardResult.ok) return discardResult;
    handAfterDiscards = discardResult.value.hand;
    installedAfterDiscards = discardResult.value.installed;
    discardedCardIds = discardResult.value.discardedCardIds;
  }

  const requiredAnyHandDiscardCount = card.cost.requiredAnyHandDiscardCount ?? 0;
  if (requiredAnyHandDiscardCount > 0) {
    const chosen = action.anyDiscardCardIds ?? [];
    if (chosen.length !== requiredAnyHandDiscardCount) {
      return fail(
        new EngineError(
          `捨てるカードの指定数が一致しません（必要: ${requiredAnyHandDiscardCount}, 指定: ${chosen.length}）`,
          "DISCARD_COUNT_MISMATCH",
        ),
      );
    }
    const remainingHand = [...handAfterDiscards];
    for (const cardId of chosen) {
      const idx = remainingHand.indexOf(cardId);
      if (idx === -1) {
        return fail(
          new EngineError(`手札にないカードを捨てようとしました: ${cardId}`, "CARD_NOT_IN_HAND"),
        );
      }
      remainingHand.splice(idx, 1);
    }
    handAfterDiscards = remainingHand;
    discardedCardIds = [...discardedCardIds, ...chosen];
  }

  const requiredDiceBreadCount = card.cost.requiredDiceBreadCount ?? 0;
  if (diceBreadCardsAfterPipSum.length < requiredDiceBreadCount) {
    return fail(
      new EngineError(
        `サイコロパンカードが不足しています（必要: ${requiredDiceBreadCount}, 所持: ${diceBreadCardsAfterPipSum.length}）`,
        "INSUFFICIENT_DISCARD_MATERIAL",
      ),
    );
  }
  const diceBreadCardsAfter = diceBreadCardsAfterPipSum.slice(
    0,
    diceBreadCardsAfterPipSum.length - requiredDiceBreadCount,
  );
  const totalDiceBreadSpent = pipSumDiceBreadSpent + requiredDiceBreadCount;

  const installed: InstalledCard = {
    instanceId: crypto.randomUUID(),
    cardId: action.cardId,
    installedThisTurn: true,
    usedThisTurn: false,
  };

  const isRow1 = action.row === "legend1";
  const newRow = row.filter((id) => id !== action.cardId);

  // レジェンドⅠを設置したら、対応する列のⅡが新たに設置可能になる（山札から新カードを引くのではなく、
  // 既に決まっている対応関係＝legendColumns に基づいてⅡをlegend2Rowへ追加する）。
  let legend1Row = isRow1 ? newRow : state.legend1Row;
  let legend2Row = isRow1 ? state.legend2Row : newRow;
  if (isRow1) {
    const column = state.legendColumns.find((c) => c.legend1Id === action.cardId);
    if (column && !legend2Row.includes(column.legend2Id)) {
      legend2Row = [...legend2Row, column.legend2Id];
    }
  }

  return ok({
    ...state,
    dice: diceResultValue,
    marketDiscard: [...state.marketDiscard, ...discardedCardIds],
    diceBreadDiscardCount: state.diceBreadDiscardCount + totalDiceBreadSpent,
    legend1Row,
    legend2Row,
    legendPlacedThisTurn: true,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        power: powerResult.value,
        hand: handAfterDiscards,
        installed: [...installedAfterDiscards, installed],
        diceBreadCards: diceBreadCardsAfter,
        victoryPoints: player.victoryPoints + (card.victoryPoints ?? 0),
        pendingBargainRingReduction: bargainRingUsed ? undefined : player.pendingBargainRingReduction,
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
    if (diceBreadCards.length < 1) {
      return fail(new EngineError("サイコロパンカードを持っていません", "NO_DICE_BREAD"));
    }
    diceBreadCards = diceBreadCards.slice(0, -1);
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

/** ソフィ専用：手札のマーケットカードを1枚捨てて、金/権/魔いずれか1種類のパワーを1つ得る。 */
function sophieDiscardForPower(
  state: GameState,
  action: Extract<GameAction, { type: "SOPHIE_DISCARD_FOR_POWER" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (player.characterId !== "char.sophie") {
    return fail(new EngineError("この能力はソフィのみ使用できます", "NOT_SOPHIE"));
  }
  const idx = player.hand.indexOf(action.cardId);
  if (idx === -1) {
    return fail(new EngineError("そのカードは手札にありません", "CARD_NOT_IN_HAND"));
  }
  const newHand = [...player.hand];
  newHand.splice(idx, 1);

  return ok({
    ...state,
    marketDiscard: [...state.marketDiscard, action.cardId],
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        hand: newHand,
        power: { ...player.power, [action.powerType]: player.power[action.powerType] + 1 },
      },
    },
  });
}

/** ショコラ専用：自分が所有する1つのパワーをパワー置き場に戻し、別のパワー1つを得る（1:1交換）。 */
function chocolatConvertPower(
  state: GameState,
  action: Extract<GameAction, { type: "CHOCOLAT_CONVERT_POWER" }>,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnActions");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (player.characterId !== "char.chocolat") {
    return fail(new EngineError("この能力はショコラのみ使用できます", "NOT_CHOCOLAT"));
  }
  if (action.from === action.to) {
    return fail(new EngineError("変換元と変換先が同じです", "SAME_POWER_TYPE"));
  }
  const powerResult = payPower(player.power, { [action.from]: 1 } as Partial<Record<PowerType, number>>);
  if (!powerResult.ok) return powerResult;
  const newPower = { ...powerResult.value, [action.to]: powerResult.value[action.to] + 1 };

  return ok({
    ...state,
    players: { ...state.players, [action.playerId]: { ...player, power: newPower } },
  });
}

/**
 * クロワ専用：ゲーム中1度だけ、自分のターンに何もしない代わりに、オープンマーケットから
 * カードを1枚無償で直接設置し、そのままターンを終える。
 */
function croixSkipTurnInstall(
  state: GameState,
  action: Extract<GameAction, { type: "CROIX_SKIP_TURN_INSTALL" }>,
  rng: Rng,
): EngineResult<GameState> {
  const turnCheck = requireCurrentPlayerTurn(state, action.playerId, "turnStart");
  if (!turnCheck.ok) return turnCheck;
  const playerResult = requirePlayer(state, action.playerId);
  if (!playerResult.ok) return playerResult;
  const player = playerResult.value;

  if (player.characterId !== "char.croix") {
    return fail(new EngineError("この能力はクロワのみ使用できます", "NOT_CROIX"));
  }
  if (player.croixSkipAbilityUsed) {
    return fail(new EngineError("この能力はゲーム中1度しか使用できません", "CROIX_ABILITY_USED"));
  }
  if (!state.openMarket.includes(action.cardId)) {
    return fail(new EngineError("指定されたカードは場札にありません", "CARD_NOT_IN_MARKET"));
  }

  const card = getMarketCard(action.cardId);
  const installed: InstalledCard = {
    instanceId: crypto.randomUUID(),
    cardId: action.cardId,
    installedThisTurn: true,
    usedThisTurn: false,
  };

  const afterInstall: GameState = {
    ...state,
    openMarket: (() => {
      const idx = state.openMarket.indexOf(action.cardId);
      const next = [...state.openMarket];
      next.splice(idx, 1);
      return next;
    })(),
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        croixSkipAbilityUsed: true,
        installed: [...player.installed, installed],
        victoryPoints: player.victoryPoints + (card.victoryPoints ?? 0),
      },
    },
    log: [
      ...state.log,
      {
        turn: state.turnNumber,
        playerId: action.playerId,
        type: "CROIX_SKIP_TURN_INSTALL",
        detail: `ターンをスキップし、${card.name} を無償設置しました`,
      },
    ],
  };

  return ok(advanceTurn(afterInstall, action.playerId, rng));
}

/**
 * PendingChoice（パネテリア遊園地のカード種別選択、二ツ星のブレスレット／五ツ星のネックレスの
 * 権/魔選択）を解決する。手番プレイヤーの制約は課さない（選択の対象者本人であればいつでもよい）。
 */
function resolvePendingChoice(
  state: GameState,
  action: Extract<GameAction, { type: "RESOLVE_PENDING_CHOICE" }>,
): EngineResult<GameState> {
  const choice = state.pendingChoices.find((c) => c.id === action.choiceId);
  if (!choice) {
    return fail(new EngineError("指定された選択はもう存在しません", "PENDING_CHOICE_NOT_FOUND"));
  }
  if (choice.playerId !== action.playerId) {
    return fail(new EngineError("これはあなたが解決すべき選択ではありません", "NOT_YOUR_PENDING_CHOICE"));
  }

  const remainingChoices = state.pendingChoices.filter((c) => c.id !== action.choiceId);

  if (choice.kind === "paneteriaCardType") {
    if (!action.cardId || !state.openMarket.includes(action.cardId)) {
      return fail(
        new EngineError("指定されたカードは現在の場札にありません", "CARD_NOT_IN_MARKET"),
      );
    }
    const player = state.players[action.playerId]!;
    const acquired = state.openMarket.filter((id) => id === action.cardId);
    const remainingMarket = state.openMarket.filter((id) => id !== action.cardId);
    return ok({
      ...state,
      openMarket: remainingMarket,
      pendingChoices: remainingChoices,
      players: {
        ...state.players,
        [action.playerId]: { ...player, hand: [...player.hand, ...acquired] },
      },
    });
  }

  // twoStarBraceletPower | fiveStarNecklacePower
  if (action.powerType !== "authority" && action.powerType !== "magic") {
    return fail(
      new EngineError("powerType は authority か magic を指定してください", "INVALID_POWER_CHOICE"),
    );
  }
  const player = state.players[action.playerId]!;
  const amount = choice.amount ?? 0;
  return ok({
    ...state,
    pendingChoices: remainingChoices,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        power: { ...player.power, [action.powerType]: player.power[action.powerType] + amount },
      },
    },
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

  const discardDiceBreadCount = action.discardDiceBreadCount ?? 0;
  if (discardDiceBreadCount > player.diceBreadCards.length) {
    return fail(
      new EngineError(
        "持っている枚数を超えてサイコロパンカードを捨てようとしました",
        "NOT_ENOUGH_DICE_BREAD",
      ),
    );
  }
  const newDiceBreadCards = player.diceBreadCards.slice(
    0,
    player.diceBreadCards.length - discardDiceBreadCount,
  );

  // 手札上限は「マーケットカード＋サイコロパンカード」の合計に対して適用される
  if (newHand.length + newDiceBreadCards.length > player.handLimit) {
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
    diceBreadDiscardCount: state.diceBreadDiscardCount + discardDiceBreadCount,
    players: {
      ...state.players,
      [action.playerId]: { ...player, hand: newHand, diceBreadCards: newDiceBreadCards },
    },
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

  // 手札上限は「マーケットカード＋サイコロパンカード」の合計に対して適用される
  if (player.hand.length + player.diceBreadCards.length > player.handLimit) {
    return fail(
      new EngineError(
        `手札上限（${player.handLimit}枚）を超えています。先に DISCARD_TO_HAND_LIMIT を行ってください`,
        "MUST_DISCARD_FIRST",
      ),
    );
  }

  return ok(advanceTurn(state, action.playerId, rng));
}

/**
 * ターン終了共通処理：設置済みカードのフラグリセット、場札補充、20VP到達チェック、
 * 次のプレイヤーへの手番移行（または最終ラウンド後のゲーム終了）を行う。
 * END_TURN と CROIX_SKIP_TURN_INSTALL（ターンスキップ）の両方から呼ばれる。
 */
function advanceTurn(state: GameState, playerId: string, rng: Rng): GameState {
  const player = state.players[playerId]!;

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
      [playerId]: {
        ...player,
        installed: resetInstalled,
        pendingBargainRingReduction: undefined,
        flanBonusUsedThisTurn: false,
      },
    },
    legendPlacedThisTurn: false,
  };
  next = refillOpenMarket(next, rng);

  // 20VP到達チェック（本来はVPが変化した瞬間に判定すべきだが、保険としてターン終了時にも確認する）
  if (next.finalRoundTriggeredBy === null) {
    const trigger = next.playerOrder.find((id) => computeTotalVictoryPoints(next, id) >= 20);
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
    return finishGame(next);
  }

  return {
    ...next,
    currentPlayerIndex: nextIndex,
    phase: "turnStart",
    dice: [],
    turnNumber: next.turnNumber + 1,
    log: [
      ...next.log,
      { turn: next.turnNumber, playerId, type: "END_TURN", detail: "ターン終了" },
    ],
  };
}

function finishGame(state: GameState): GameState {
  let bestVp = -Infinity;
  for (const id of state.playerOrder) {
    bestVp = Math.max(bestVp, computeTotalVictoryPoints(state, id));
  }
  let vpTied = state.playerOrder.filter((id) => computeTotalVictoryPoints(state, id) === bestVp);

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
