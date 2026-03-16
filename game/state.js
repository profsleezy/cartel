// game/state.js
// Single source of truth for game state. Nothing else should create its own copy.

export const gameState = {
  phase: "Buying",
  timer: 45,
  roundNumber: 1,
  players: [
    {
      id: "player1",
      cash: 50000,
      dealers: 3,
      pushers: 1,
      soldThisRound: 0,
      hand: [],
    },
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

    gameState.districts = data.map((d) => {
      const basePrices = {
        coke: d.prices && d.prices.coke ? roundTo500(d.prices.coke) : 7500,
        weed: d.prices && d.prices.weed ? roundTo500(d.prices.weed) : 5000,
        heroin: d.prices && d.prices.heroin ? roundTo500(d.prices.heroin) : 6500,
      };

      // Random specialty and weakness per district, not the same product.
      const specialty = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      let weakness = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      while (weakness === specialty) {
        weakness = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
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

    function roundTo500(value) {
      if (typeof value !== "number") return 500;
      return Math.round(value / 500) * 500;
    }

    // for a tiny hand-tuned starting state, mark some districts with player IDs
    const assign = {
      d1: "player1",
      d3: "player1",
      d6: "player1",
      d10: "player1",
      d4: "enemy1",
      d8: "enemy1",
      d12: "enemy1",
    };
    gameState.districts.forEach((ds) => {
      if (assign[ds.id]) ds.owner = assign[ds.id];
    });

    // give each player-owned district a starting thug
    gameState.districts.forEach((ds) => {
      if (ds.owner === "player1") ds.thugs = 1;
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
  // simple rule: if there are no districts owned by the human player, remove them
  const ownedCount = gameState.districts.filter(
    (d) => d.owner === "player1",
  ).length;
  if (ownedCount === 0 && gameState.players.length > 0) {
    const rem = gameState.players.splice(0, 1);
    if (rem && rem.length) removed.push(rem[0].id);
  }
  return removed;
}

/**
 * Find and return a player by ID from gameState.players.
 * Defaults to 'player1' for the local human player.
 */
export function getPlayer(id = "player1") {
  return gameState.players.find((p) => p.id === id) || null;
}
