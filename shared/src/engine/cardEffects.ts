import type { GameState, PowerType, InstalledCard, DieFace, VictoryPointsFormula, PendingChoice } from "../types.js";
import type { ResolveTurnStartAction } from "../actions.js";
import type { Rng } from "../rng.js";
import { shuffle } from "../rng.js";
import { getMarketCard } from "../cards/index.js";
import { EngineError, type EngineResult, ok, fail } from "./errors.js";
import { refillOpenMarket } from "./market.js";

/**
 * カード・キャラクターの「ターン開始時」効果、「設置時に即時発動」効果、
 * 他プレイヤーの行動で発動する「条件発動」効果、および動的VP計算をまとめたモジュール。
 *
 * reducer.ts の各アクションハンドラから呼び出される。ここに実装がある効果は
 * 対応するカード/キャラクターデータの hasProgrammaticEffect が true になっている。
 */

function addPower(power: Record<PowerType, number>, type: PowerType, amount: number) {
  return { ...power, [type]: power[type] + amount };
}

function withPower(state: GameState, playerId: string, type: PowerType, amount: number): GameState {
  const player = state.players[playerId]!;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, power: addPower(player.power, type, amount) } },
  };
}

function withHand(state: GameState, playerId: string, hand: string[]): GameState {
  const player = state.players[playerId]!;
  return { ...state, players: { ...state.players, [playerId]: { ...player, hand } } };
}

function withDiceBread(state: GameState, playerId: string, drawn: readonly DieFace[]): GameState {
  const player = state.players[playerId]!;
  return {
    ...state,
    diceBreadDeckCount: Math.max(0, state.diceBreadDeckCount - drawn.length),
    players: {
      ...state.players,
      [playerId]: { ...player, diceBreadCards: [...player.diceBreadCards, ...drawn] },
    },
  };
}

function drawMarketCards(
  state: GameState,
  rng: Rng,
  count: number,
): { drawn: string[]; marketDeck: string[]; marketDiscard: string[] } {
  let marketDeck = [...state.marketDeck];
  let marketDiscard = [...state.marketDiscard];
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    if (marketDeck.length === 0) {
      if (marketDiscard.length === 0) break;
      marketDeck = shuffle(marketDiscard, rng);
      marketDiscard = [];
    }
    drawn.push(marketDeck.shift()!);
  }
  return { drawn, marketDeck, marketDiscard };
}

/**
 * サイコロパンの「ドロー」。山札の出目構成（何の目が何枚あるか）は一次資料が乏しく未モデル化のため、
 * 出目は乱数で1〜6を割り当てる暫定実装（`diceBreadDeckCount` は消費した枚数分だけ減算する）。
 */
function drawDiceBread(
  state: GameState,
  rng: Rng,
  count: number,
): { drawn: readonly DieFace[] } {
  const available = Math.max(0, Math.min(count, state.diceBreadDeckCount));
  const drawn = Array.from({ length: available }, () => (Math.floor(rng.next() * 6) + 1) as DieFace);
  return { drawn };
}

function amountByPlayerCount(playerCount: number): number {
  if (playerCount <= 2) return 3;
  if (playerCount === 3) return 2;
  return 1;
}

interface TurnStartCtx {
  state: GameState;
  playerId: string;
  rng: Rng;
  action: ResolveTurnStartAction;
}

/** キャラクター固有の「ターン開始時」効果。該当能力がなければ state をそのまま返す。 */
function applyCharacterTurnStart(ctx: TurnStartCtx): EngineResult<GameState> {
  const { state, playerId, rng, action } = ctx;
  const player = state.players[playerId]!;

  switch (player.characterId) {
    case "char.coronelia":
    case "char.chocolat": {
      const amount = player.characterId === "char.chocolat" ? 2 : 1;
      // 本来はプレイヤーが金/権/魔から選ぶが、クライアントに選択UIが無い間は
      // characterPowerChoice 省略時に「money」へフォールバックし、進行を止めない。
      const powerType = action.characterPowerChoice ?? "money";
      return ok(withPower(state, playerId, powerType, amount));
    }
    case "char.anne": {
      const { drawn } = drawDiceBread(state, rng, 2);
      return ok(withDiceBread(state, playerId, drawn));
    }
    case "char.sophie": {
      const { drawn, marketDeck, marketDiscard } = drawMarketCards(state, rng, 2);
      return ok({
        ...withHand(state, playerId, [...player.hand, ...drawn]),
        marketDeck,
        marketDiscard,
      });
    }
    case "char.croix":
      return ok(withPower(state, playerId, "money", 1));
    case "char.roll":
      return ok(withPower(state, playerId, "authority", 1));
    default:
      return ok(state);
  }
}

/** 設置済みカード1枚分の「ターン開始時」効果。効果がなければ state をそのまま返す。 */
function applyInstalledCardTurnStart(
  state: GameState,
  playerId: string,
  card: InstalledCard,
  rng: Rng,
  action: ResolveTurnStartAction,
): EngineResult<GameState> {
  const player = state.players[playerId]!;

  switch (card.cardId) {
    case "std.bakery":
      return ok(withPower(state, playerId, "money", 1));
    case "std.tavern":
      return ok(withPower(state, playerId, "authority", 1));
    case "std.cakeShop":
      return ok(withPower(state, playerId, "magic", 1));
    case "adv.premiumBakery":
      return ok(withPower(state, playerId, "money", 3));
    case "adv.grandTavern":
      return ok(withPower(state, playerId, "authority", 3));
    case "adv.masterCakeShop":
      return ok(withPower(state, playerId, "magic", 3));

    case "std.oven":
      return ok(withDiceBread(state, playerId, drawDiceBread(state, rng, 1).drawn));
    case "adv.magicOven":
      return ok(withDiceBread(state, playerId, drawDiceBread(state, rng, 2).drawn));

    case "std.church": {
      const { drawn, marketDeck, marketDiscard } = drawMarketCards(state, rng, 1);
      return ok({
        ...withHand(state, playerId, [...player.hand, ...drawn]),
        marketDeck,
        marketDiscard,
      });
    }

    case "adv.blackMarket": {
      // 本来はプレイヤーが3択から選ぶが、クライアントに選択UIが無い間は
      // 未指定時に「market」（マーケットカードを引く）へフォールバックし、進行を止めない。
      const choice = action.blackMarketChoices?.[card.instanceId] ?? { option: "market" as const };
      if (choice.option === "market") {
        const { drawn, marketDeck, marketDiscard } = drawMarketCards(state, rng, 1);
        return ok({
          ...withHand(state, playerId, [...player.hand, ...drawn]),
          marketDeck,
          marketDiscard,
        });
      }
      if (choice.option === "diceBread") {
        return ok(withDiceBread(state, playerId, drawDiceBread(state, rng, 1).drawn));
      }
      const powerType = choice.powerType ?? "money";
      return ok(withPower(state, playerId, powerType, 1));
    }

    case "adv.thievesGuild": {
      const threshold = 5;
      const qualifying = state.playerOrder.filter((id) => {
        if (id === playerId) return false;
        const p = state.players[id]!;
        return p.power.money + p.power.authority + p.power.magic >= threshold;
      });
      if (qualifying.length === 0) return ok(state);
      const perOpponent = amountByPlayerCount(state.playerOrder.length);
      const total = perOpponent * qualifying.length;
      const powerType = action.characterPowerChoice ?? "money";
      return ok(withPower(state, playerId, powerType, total));
    }

    default:
      return ok(state);
  }
}

/** ターン開始時：キャラクター能力→設置済みカード（設置順）の順に、フェイズ1の全効果を適用する。 */
export function applyTurnStartEffects(
  state: GameState,
  playerId: string,
  rng: Rng,
  action: ResolveTurnStartAction,
): EngineResult<GameState> {
  const charResult = applyCharacterTurnStart({ state, playerId, rng, action });
  if (!charResult.ok) return charResult;
  let current = charResult.value;

  const installedSnapshot = current.players[playerId]!.installed;
  for (const card of installedSnapshot) {
    const result = applyInstalledCardTurnStart(current, playerId, card, rng, action);
    if (!result.ok) return result;
    current = result.value;
  }

  return ok(current);
}

/** 設置時に即時発動する効果（B行動でカードを設置した直後に呼ぶ）。 */
export function applyInstallImmediateEffect(
  state: GameState,
  playerId: string,
  cardId: string,
  rng: Rng,
): GameState {
  switch (cardId) {
    case "adv.armsDealer": {
      let next = state;
      for (const type of ["money", "authority", "magic"] as const) {
        next = withPower(next, playerId, type, 3);
      }
      for (const otherId of state.playerOrder) {
        if (otherId === playerId) continue;
        for (const type of ["money", "authority", "magic"] as const) {
          next = withPower(next, otherId, type, 1);
        }
      }
      return next;
    }
    case "adv.harvestFestival": {
      let next = withDiceBread(state, playerId, drawDiceBread(state, rng, 3).drawn);
      for (const otherId of state.playerOrder) {
        if (otherId === playerId) continue;
        next = withDiceBread(next, otherId, drawDiceBread(next, rng, 1).drawn);
      }
      return next;
    }
    case "adv.paneteriaAmusementPark": {
      let next: GameState = {
        ...state,
        marketDiscard: [...state.marketDiscard, ...state.openMarket],
        openMarket: [],
      };
      next = refillOpenMarket(next, rng);

      // あなたから時計回りにプレイヤー全員がオープンマーケットからカードを1種類ずつ獲得する。
      // 各プレイヤー本人の選択なので、即時に決めず PendingChoice として積んでおき、
      // RESOLVE_PENDING_CHOICE（reducer.ts）で本人が選んだ時点で確定させる。
      const installerIdx = state.playerOrder.indexOf(playerId);
      const order = state.playerOrder.map(
        (_, i) => state.playerOrder[(installerIdx + i) % state.playerOrder.length]!,
      );
      const newChoices: PendingChoice[] =
        next.openMarket.length > 0
          ? order.map((pid) => ({ id: crypto.randomUUID(), playerId: pid, kind: "paneteriaCardType" as const }))
          : [];
      return { ...next, pendingChoices: [...next.pendingChoices, ...newChoices] };
    }
    case "adv.blackCatCasino": {
      const { drawn, marketDeck, marketDiscard } = drawMarketCards(state, rng, 1);
      if (drawn.length === 0) return state;
      const player = state.players[playerId]!;
      const installed: InstalledCard = {
        instanceId: crypto.randomUUID(),
        cardId: drawn[0]!,
        installedThisTurn: true,
        usedThisTurn: false,
      };
      const cardDef = getMarketCard(drawn[0]!);
      return {
        ...state,
        marketDeck,
        marketDiscard,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            installed: [...player.installed, installed],
            victoryPoints: player.victoryPoints + (cardDef.victoryPoints ?? 0),
          },
        },
      };
    }
    default:
      return state;
  }
}

/**
 * 他プレイヤーがマーケットカードを1枚「設置」した直後に呼ぶ条件発動効果（みかじめ騎士団）。
 * actingPlayerId は設置を行った本人。
 */
export function applyOtherPlayersInstallTrigger(state: GameState, actingPlayerId: string): GameState {
  let next = state;
  for (const ownerId of state.playerOrder) {
    if (ownerId === actingPlayerId) continue;
    const owner = state.players[ownerId]!;
    for (const card of owner.installed) {
      if (card.cardId !== "adv.protectionKnights") continue;
      const amount = amountByPlayerCount(state.playerOrder.length);
      next = withPower(next, ownerId, "money", amount);
    }
  }
  return next;
}

/** 他プレイヤーがマーケットカードを1種類「獲得」した直後に呼ぶ条件発動効果（徴税の路地裏）。 */
export function applyOtherPlayersAcquireTrigger(state: GameState, actingPlayerId: string): GameState {
  let next = state;
  for (const ownerId of state.playerOrder) {
    if (ownerId === actingPlayerId) continue;
    const owner = state.players[ownerId]!;
    for (const card of owner.installed) {
      if (card.cardId !== "adv.taxAlley") continue;
      const amount = amountByPlayerCount(state.playerOrder.length);
      next = withPower(next, ownerId, "money", amount);
    }
  }
  return next;
}

/**
 * 他プレイヤーがサイコロパンカードを獲得した直後に呼ぶ条件発動効果（王立パン協会）。
 * gainedCount は今回獲得した枚数（ターン開始時効果等での純増分）。
 */
export function applyOtherPlayersDiceBreadGainTrigger(
  state: GameState,
  gainerId: string,
  gainedCount: number,
): GameState {
  if (gainedCount <= 0) return state;
  let next = state;
  for (const ownerId of state.playerOrder) {
    if (ownerId === gainerId) continue;
    const owner = state.players[ownerId]!;
    for (const card of owner.installed) {
      if (card.cardId !== "adv.royalBakeryGuild") continue;
      const amount = amountByPlayerCount(state.playerOrder.length) * gainedCount;
      next = withPower(next, ownerId, "authority", amount);
    }
  }
  return next;
}

/**
 * 他プレイヤーがダイスを振って特定の出目を出した直後に呼ぶ条件発動効果
 * （二ツ星のブレスレット＝出目2、五ツ星のネックレス＝出目5）。サイコロパンの出目は対象外。
 * 得るパワー種別（権/魔のいずれか）はオーナー本人の選択制のため、即時に確定させず
 * PendingChoice として積んでおき、RESOLVE_PENDING_CHOICE（reducer.ts）で確定させる。
 */
export function applyOtherPlayersDiceRollTrigger(
  state: GameState,
  rollerId: string,
  faces: readonly number[],
): GameState {
  let next = state;
  const countFace = (face: number) => faces.filter((f) => f === face).length;
  const newChoices: PendingChoice[] = [];

  for (const ownerId of state.playerOrder) {
    if (ownerId === rollerId) continue;
    const owner = state.players[ownerId]!;
    for (const card of owner.installed) {
      const kind =
        card.cardId === "adv.twoStarBracelet"
          ? ("twoStarBraceletPower" as const)
          : card.cardId === "adv.fiveStarNecklace"
            ? ("fiveStarNecklacePower" as const)
            : null;
      if (kind === null) continue;
      const triggerFace = kind === "twoStarBraceletPower" ? 2 : 5;
      const times = countFace(triggerFace);
      if (times === 0) continue;
      const amount = amountByPlayerCount(state.playerOrder.length) * times;
      newChoices.push({ id: crypto.randomUUID(), playerId: ownerId, kind, amount });
    }
  }
  if (newChoices.length > 0) {
    next = { ...next, pendingChoices: [...next.pendingChoices, ...newChoices] };
  }
  return next;
}

/** カード上のトークン数を反映した、動的VPも含む合計VPを計算する。 */
export function computeTotalVictoryPoints(state: GameState, playerId: string): number {
  const player = state.players[playerId]!;
  let total = player.victoryPoints;

  for (const card of player.installed) {
    const def = getMarketCard(card.cardId);
    if (def.victoryPoints !== null || !def.victoryPointsFormula) continue;
    total += computeFormulaVictoryPoints(state, playerId, card, def.victoryPointsFormula);
  }
  return total;
}

function computeFormulaVictoryPoints(
  state: GameState,
  playerId: string,
  card: InstalledCard,
  formula: VictoryPointsFormula,
): number {
  const player = state.players[playerId]!;
  switch (formula.kind) {
    case "perInstalledCardCount": {
      const count = player.installed.filter((c) => c.cardId === formula.cardId).length;
      return (formula.base ?? 0) + count * formula.pointsPerCard;
    }
    case "perPowerCostEvery": {
      let total = 0;
      for (const c of player.installed) {
        const d = getMarketCard(c.cardId);
        total += d.cost?.[formula.powerType] ?? 0;
      }
      return Math.floor(total / formula.divisor);
    }
    case "tokensOnCard":
      return card.tokens ?? 0;
  }
  void state;
}
