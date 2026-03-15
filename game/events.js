// game/events.js
// Draws a random event each round and applies its effect to the game state.
// Also exports applyEffect() — the shared effect engine used by both events and cards.js.

import { gameState, getPlayer } from "./state.js";
import { addHeat, triggerRaid } from "./heat.js";

let eventsData = [];

/** Fetch and cache the events pool from data/events.json. Called once at startup. */
export async function initEvents() {
  const res = await fetch("/data/events.json");
  if (!res.ok) throw new Error("Failed to load events.json");
  eventsData = await res.json();
}

// Probability that any event fires at the start of a round.
// ~3 out of 5 rounds will have an event; the rest are quiet.
const EVENT_FIRE_CHANCE = 0.6;

/**
 * Select one item from a weighted pool using linear scan.
 * Each item must have a numeric `weight` property (default 1).
 */
function weightedRandom(pool) {
  const total = pool.reduce((sum, e) => sum + (e.weight || 1), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight || 1;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * Possibly draw a random event for this round.
 * There is a EVENT_FIRE_CHANCE probability that an event fires at all.
 * When one does, it is chosen by weighted random so critical events
 * (low weight) appear far less often than minor ones (high weight).
 * Sets gameState.currentEvent to the chosen event or null, then returns it.
 * Called at the start of each Buying phase (= round start).
 */
export function drawEventTile() {
  // Roll to see if any event fires this round
  if (!eventsData.length || Math.random() > EVENT_FIRE_CHANCE) {
    gameState.currentEvent = null;
    return null;
  }
  const ev = weightedRandom(eventsData);
  gameState.currentEvent = { ...ev };
  return gameState.currentEvent;
}

/**
 * Apply the effect of gameState.currentEvent.
 * Called immediately after drawEventTile() at Buying phase start.
 */
export function applyEventEffect() {
  const ev = gameState.currentEvent;
  if (!ev || !ev.effect) return;
  applyEffect(ev.effect);

  // Log to news feed so the player sees what happened
  if (!gameState.news) gameState.news = [];
  gameState.news.push({
    text: `Event: ${ev.name} — ${ev.description}`,
    ts: Date.now(),
  });
  if (gameState.news.length > 50) gameState.news = gameState.news.slice(-50);
}

/**
 * Shared effect applicator — called by applyEventEffect() and by cards.js playCard().
 *
 * Immediate effects (cash, heat, thugs, free_pusher, raid_random) are applied
 * directly to state. Round-modifier effects (price_surge, price_drop,
 * production_boost, raid_immunity, stash_protect, pusher_double, extra_attack)
 * are stored in gameState.eventModifiers and read by phases.js / economy.js
 * during the relevant phase.
 *
 * Multiplier modifiers stack multiplicatively so an event + a card both granting
 * a price surge compound rather than one overwriting the other.
 */
export function applyEffect(effect) {
  if (!effect || !effect.type) return;

  const player = getPlayer("player1");
  const owned = gameState.districts.filter((d) => d.owner === "player1");

  // Ensure the modifiers bag exists
  if (!gameState.eventModifiers) gameState.eventModifiers = {};
  const mods = gameState.eventModifiers;

  switch (effect.type) {
    // ── Immediate: cash ────────────────────────────────────────────────────
    case "cash_bonus":
      if (player)
        player.cash = Math.round((player.cash + (effect.value || 0)) / 5) * 5;
      break;

    case "cash_penalty":
      if (player)
        player.cash = Math.max(
          0,
          Math.round((player.cash - (effect.value || 0)) / 5) * 5,
        );
      break;

    // ── Immediate: heat ────────────────────────────────────────────────────
    case "heat_all":
      owned.forEach((d) => addHeat(d.id, effect.value || 1));
      break;

    case "heat_decay":
      owned.forEach((d) => {
        if (typeof d.heat === "number")
          d.heat = Math.max(0, d.heat - (effect.value || 1));
      });
      break;

    // ── Immediate: thugs ───────────────────────────────────────────────────
    case "thug_bonus":
      owned.forEach((d) => {
        d.thugs = (d.thugs || 0) + (effect.value || 1);
      });
      break;

    // ── Immediate: pusher ──────────────────────────────────────────────────
    case "free_pusher":
      if (player) player.pushers = (player.pushers || 0) + (effect.value || 1);
      break;

    // ── Immediate: random raid ─────────────────────────────────────────────
    case "raid_random": {
      if (!owned.length) break;
      const tgt = owned[Math.floor(Math.random() * owned.length)];
      triggerRaid(tgt.id);
      if (!gameState.news) gameState.news = [];
      gameState.news.push({
        text: `Fed Raid: ${tgt.name} has been raided!`,
        ts: Date.now(),
      });
      if (gameState.news.length > 50) gameState.news = gameState.news.slice(-50);
      break;
    }

    // ── Round modifier: dealing price multiplier (stacks) ─────────────────
    case "price_surge":
      mods.priceMultiplier =
        (mods.priceMultiplier || 1) * (effect.value || 1.25);
      break;

    case "price_drop":
      mods.priceMultiplier =
        (mods.priceMultiplier || 1) * (effect.value || 0.75);
      break;

    // ── Round modifier: production multiplier (stacks) ────────────────────
    case "production_boost":
      mods.productionMultiplier =
        (mods.productionMultiplier || 1) * (effect.value || 2);
      break;

    // ── Round modifier: flags ──────────────────────────────────────────────
    case "raid_immunity":
      mods.raidImmunity = true;
      break;

    case "stash_protect":
      mods.stashProtect = true;
      break;

    case "pusher_double":
      mods.pusherCapacityMultiplier = (mods.pusherCapacityMultiplier || 1) * 2;
      break;

    case "extra_attack":
      mods.extraAttack = true;
      break;

    default:
      console.warn("[events.js] Unknown effect type:", effect.type);
  }
}
