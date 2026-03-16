// game/state.js
import { rand, reseed, shuffle } from './rng.js';
// Single source of truth for game state. Nothing else should create its own copy.

export const gameState = {
  phase: "Buying",
  timer: 45,
  roundNumber: 1,
  players: [
    // use createPlayer below to ensure parity when creating players
    // default local human retained for backwards-compatibility
  ],
  // districts will be populated by initGameState() from data/districts.json
  districts: [],
  // current round event tile (set by drawEventTile() each Buying phase)
  currentEvent: null,
  // long-term card effects active this round: [{ name, effectType, description }]
  // reset at each Buying phase start alongside eventModifiers
  activeCardEffects: [],
  // round-scoped modifiers set by events and cards; reset at each Buying phase start
  // { priceMultiplier, productionMultiplier, raidImmunity, stashProtect, pusherCapacityMultiplier, extraAttack }
  eventModifiers: {},
};

// create default initial player(s) to keep backwards compat with existing UI
export function createPlayer(id = "player1", isBot = false) {
  return {
    id,
    isBot: Boolean(isBot),
    name: id,
    cash: 50000,
    dealers: 3,
    pushers: 1,
    soldThisRound: 0,
    hand: [],
    buildingsBoughtThisRound: { lab: 0, growhouse: 0, refinery: 0 },
    thugsHiredThisRound: 0,
    hasAttackedThisRound: false,
  };
}

// ensure a default human player exists for compatibility
if (!gameState.players || gameState.players.length === 0) {
  gameState.players = [createPlayer("player1", false)];
}

/**
 * Add a news entry and notify listeners.
 * Ensures the `gameState.news` array is kept to a reasonable size
 * and dispatches a `newsAdded` event on `window` with the new entry.
 */
export function addNews(text) {
  if (!gameState.news) gameState.news = [];
  const entry = { text: String(text), ts: Date.now() };
  gameState.news.push(entry);
  if (gameState.news.length > 50) gameState.news = gameState.news.slice(-50);
  try {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('newsAdded', { detail: entry }));
  } catch (err) {
    // ignore in non-window environments
  }
  return entry;
}

// queued attacks between phases
export function ensureQueuedAttacks() {
  if (!gameState.queuedAttacks) gameState.queuedAttacks = [];
  return gameState.queuedAttacks;
}

/**
 * Queue an attack on behalf of a player.
 * Enforces one-attack-per-player-per-round unless extraAttack modifier is present.
 * Returns { success, message }.
 */
export function queueAttack(fromId, toId, thugsCount, playerId = "player1") {
  if (!gameState.queuedAttacks) gameState.queuedAttacks = [];
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: 'No player' };

  const extra = gameState.eventModifiers && gameState.eventModifiers.extraAttack;
  if (player.hasAttackedThisRound && !extra) {
    return { success: false, message: 'Player already attacked this round' };
  }

  gameState.queuedAttacks.push({ fromId, toId, thugsCount, attackerId: playerId });
  player.hasAttackedThisRound = true;

  const tgt = gameState.districts.find((x) => x.id === toId);
  if (tgt) tgt.pendingAttack = true;

  return { success: true };
}

/**
 * Initialize the gameState.districts from data/districts.json
 * This is async because we fetch the JSON file in the browser environment.
 */
export async function initGameState() {
  try {
    // index.html lives at the repo root when served, so fetch from absolute path
    const res = await fetch("/data/districts.json");
    if (!res.ok) throw new Error("Failed to load districts.json");
    const data = await res.json();

    // map to internal district shape and set sensible defaults
    const PRODUCTS = ["coke", "weed", "heroin"];
    const SPECIALTY_MULTIPLIER = 1.4;
    const WEAKNESS_MULTIPLIER = 0.75;

    // reseed RNG per game so distribution varies across runs
    try {
      const entropy = Date.now() ^ (Math.floor(Math.random() * 1000000) >>> 0);
      reseed(entropy);
    } catch (err) {}

    // 1. Shuffle the raw data first
    const rawData = [...data];
    for (let i = rawData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawData[i], rawData[j]] = [rawData[j], rawData[i]];
    }

    // 2. Map to objects in this new random order
    const districts = rawData.map((d) => {
      const basePrices = {
        coke: d.prices && d.prices.coke ? roundTo500(d.prices.coke) : 7500,
        weed: d.prices && d.prices.weed ? roundTo500(d.prices.weed) : 5000,
        heroin: d.prices && d.prices.heroin ? roundTo500(d.prices.heroin) : 6500,
      };

      // Random specialty and weakness per district, not the same product.
      const specialty = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
      let weakness = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
      while (weakness === specialty) {
        weakness = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
      }

      return {
        id: d.id,
        name: d.name,
        prices: {
          coke: basePrices.coke,
          weed: basePrices.weed,
          heroin: basePrices.heroin,
        },
        basePrices,
        specialty,
        weakness,
        adjacency: d.adjacency || [],
        owner: "neutral",
        // buildings array (max 5). entries: { type: 'lab'|'growhouse'|'refinery' }
        buildings: [],
        thugs: 0,
        heat: 0,
        stash: { coke: 0, weed: 0, heroin: 0 },
      };
    });

    // 3. One more shuffle of the objects just to be absolutely certain
    for (let i = districts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [districts[i], districts[j]] = [districts[j], districts[i]];
    }
    
    gameState.districts = districts;
    console.log('[state] Final shuffled order:', districts.map(d => d.id).join(', '));

    function roundTo500(value) {
      if (typeof value !== "number") return 500;
      return Math.round(value / 500) * 500;
    }

    // If only the default human exists, create default bots so local testing
    // has multiple players to interact with. This creates enemy1..enemy3.
    if (!gameState.players || gameState.players.length <= 1) {
      gameState.players = [createPlayer("player1", false)];
      for (let i = 1; i <= 3; i++) {
        const id = `enemy${i}`;
        gameState.players.push(createPlayer(id, true));
      }
    }

    const playerIds = gameState.players.map((p) => p.id);
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }

    gameState.districts.forEach((d) => {
      d.owner = "neutral";
      d.thugs = 0;
    });

    const maxPerPlayer = 2;
    const taken = new Set();
    playerIds.forEach((pid) => {
      let count = 0;
      while (count < maxPerPlayer && taken.size < gameState.districts.length) {
        const idx = Math.floor(Math.random() * gameState.districts.length);
        if (taken.has(idx)) continue;
        taken.add(idx);
        gameState.districts[idx].owner = pid;
        count += 1;
      }
    });

    // Give each owned district a starting thug (1)
    gameState.districts.forEach((ds) => {
      if (ds.owner && ds.owner !== 'neutral') ds.thugs = 1;
    });

    // initialize per-player purchase counters and thug counters
    gameState.players.forEach((p) => {
      p.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
      // ensure pusher and sold counters exist
      if (typeof p.pushers !== "number") p.pushers = 1;
      if (typeof p.soldThisRound !== "number") p.soldThisRound = 0;
      // thugs hired counter per round
      if (typeof p.thugsHiredThisRound !== "number") p.thugsHiredThisRound = 0;
      // attack flag per round
      if (typeof p.hasAttackedThisRound !== "boolean")
        p.hasAttackedThisRound = false;
      // card hand
      if (!Array.isArray(p.hand)) p.hand = [];
      // queued attacks array
      if (!gameState.queuedAttacks) gameState.queuedAttacks = [];
    });

    return gameState;
  } catch (err) {
    console.error("initGameState error", err);
    throw err;
  }
}

/**
 * Remove players who own zero districts. Returns array of removed player ids.
 */
export function checkElimination() {
  const removed = [];
  // remove players who own zero districts
  const playersToRemove = gameState.players.filter((p) => {
    const owned = gameState.districts.some((d) => d.owner === p.id);
    return !owned;
  });
  playersToRemove.forEach((p) => {
    const idx = gameState.players.findIndex((x) => x.id === p.id);
    if (idx >= 0) {
      const rem = gameState.players.splice(idx, 1);
      if (rem && rem.length) removed.push(rem[0].id);
    }
  });
  return removed;
}

/**
 * Check for victory: returns winning player id or null.
 * Victory occurs when a single player owns all districts.
 */
export function checkVictory() {
  if (!gameState.districts || gameState.districts.length === 0) return null;
  const owner = gameState.districts[0].owner;
  if (!owner || owner === "neutral") return null;
  const allOwned = gameState.districts.every((d) => d.owner === owner);
  if (allOwned) {
    gameState.winner = owner;
    try {
      if (typeof window !== 'undefined')
        window.dispatchEvent(new CustomEvent('gameOver', { detail: { winner: owner } }));
    } catch (err) {}
    return owner;
  }
  return null;
}

/**
 * Find and return a player by ID from gameState.players.
 * Defaults to 'player1' for the local human player.
 */
export function getPlayer(id = "player1") {
  return gameState.players.find((p) => p.id === id) || null;
}
