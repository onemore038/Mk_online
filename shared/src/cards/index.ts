import type { MarketCardDefinition, CharacterDefinition } from "../types.js";
import { CHARACTERS } from "./characters.js";
import { STANDARD_CARDS } from "./standard.js";
import { ADVANCE_CARDS } from "./advance.js";
import { LEGEND1_CARDS, LEGEND2_CARDS } from "./legend.js";

export * from "./characters.js";
export * from "./standard.js";
export * from "./advance.js";
export * from "./legend.js";

export const ALL_MARKET_CARDS: readonly MarketCardDefinition[] = [
  ...STANDARD_CARDS,
  ...ADVANCE_CARDS,
  ...LEGEND1_CARDS,
  ...LEGEND2_CARDS,
];

const MARKET_CARD_BY_ID = new Map(ALL_MARKET_CARDS.map((c) => [c.id, c]));
const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getMarketCard(cardId: string): MarketCardDefinition {
  const card = MARKET_CARD_BY_ID.get(cardId);
  if (!card) throw new Error(`未知のカードID: ${cardId}`);
  return card;
}

export function getCharacter(characterId: string): CharacterDefinition {
  const character = CHARACTER_BY_ID.get(characterId);
  if (!character) throw new Error(`未知のキャラクターID: ${characterId}`);
  return character;
}
