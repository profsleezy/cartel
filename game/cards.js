// game/cards.js
// Card system: deal, draw, and play cards from player1's hand.
// Effects are applied via the shared applyEffect() from events.js.
//
// Multiple cards can be played per round — no per-round limit.
// Cards with long-term (round-modifier) effects are tracked in
// gameState.activeCardEffects so the UI can show an indicator.

// Effect types that persist for the rest of the round rather than
// applying immediately. These get logged in activeCardEffects.
const LONG_TERM_EFFECTS = new Set([
  "price_surge",
  "price_drop",
  "production_boost",
  "raid_immunity",
  "stash_protect",
  "pusher_double",
  "extra_attack",
]);

import { gameState, getPlayer } from "./state.js";
import { applyEffect } from "./events.js";

let cardsData = [];

/**
 * Fetch and cache card definitions from data/cards.json.
 * Must be called before any other card functions.
 */
export async function initCards() {
  const res = await fetch("/data/cards.json");
  if (!res.ok) throw new Error("Failed to load cards.json");
  cardsData = await res.json();
}

/** Pick one random card from the pool and return a shallow copy. */
function pickRandom() {
  if (!cardsData.length) return null;
  return { ...cardsData[Math.floor(Math.random() * cardsData.length)] };
}

/**
 * Deal `count` random cards into player1's starting hand.
 * Called once after initCards() during game initialisation.
 */
export function dealStartingHand(count = 2) {
  const player = getPlayer("player1");
  if (!player) return;
  if (!Array.isArray(player.hand)) player.hand = [];
  for (let i = 0; i < count; i++) {
    const card = pickRandom();
    if (card) player.hand.push(card);
  }
}

/**
 * Draw one card into player1's hand.
 * Called at the end of each Buying phase (transition into Dealing).
 * Returns the drawn card, or null if the pool is empty.
 */
export function drawCard() {
  const player = getPlayer("player1");
  if (!player) return null;
  if (!Array.isArray(player.hand)) player.hand = [];
  const card = pickRandom();
  if (card) player.hand.push(card);
  return card;
}

/**
 * Attempt to play a card from player1's hand by id.
 *
 * Guards:
 *  - card must be in the player's hand
 *  - current phase must match card.phase (or card.phase === "Any")
 *
 * Multiple cards can be played per round — there is no per-round limit.
 * Cards whose effects persist for the round are recorded in
 * gameState.activeCardEffects so the UI can display an active indicator.
 *
 * Returns { success: boolean, message?: string, card? }
 */
export function playCard(cardId) {
  const player = getPlayer("player1");
  if (!player) return { success: false, message: "No player found" };
  if (!Array.isArray(player.hand))
    return { success: false, message: "Hand not initialised" };

  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { success: false, message: "Card not found in hand" };

  const card = player.hand[idx];

  // Phase gate
  if (card.phase !== "Any" && card.phase !== gameState.phase) {
    return {
      success: false,
      message: `"${card.name}" can only be played during the ${card.phase} phase`,
    };
  }

  // Apply the card's effect using the shared applicator from events.js
  applyEffect(card.effect);

  // If this card's effect lingers for the rest of the round, track it so
  // the UI can show an active indicator until the round resets.
  if (LONG_TERM_EFFECTS.has(card.effect && card.effect.type)) {
    if (!Array.isArray(gameState.activeCardEffects))
      gameState.activeCardEffects = [];
    gameState.activeCardEffects.push({
      name: card.name,
      effectType: card.effect.type,
      description: card.description,
    });
  }

  // Remove card from hand
  player.hand.splice(idx, 1);

  // Surface to the news feed
  if (!gameState.news) gameState.news = [];
  gameState.news.push({
    text: `Played: ${card.name} — ${card.description}`,
    ts: Date.now(),
  });

  return { success: true, card };
}
