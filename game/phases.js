// game/phases.js
// Manages phase transitions and the phase timer.
// All rendering is decoupled: game logic emits 'gameStateChanged' and 'gameOver'
// custom events; client/main.js listens and drives the UI.

import { gameState, checkElimination, getPlayer, addNews, checkVictory } from "./state.js";
import { runProduction } from "./economy.js";
import { decayHeat, runPassiveRaids, processRaidTimers } from "./heat.js";
import { resolveAttack } from "./combat.js";
import { drawEventTile, applyEventEffect } from "./events.js";
import { drawCard } from "./cards.js";
import * as AI from "./ai.js";
import { rand } from "./rng.js";

const PHASES = ["Buying", "Dealing", "Attacking"];
let intervalId = null;
let phaseIndex = PHASES.indexOf(gameState.phase);
if (phaseIndex === -1) phaseIndex = 0;

const DEFAULT_PHASE_SECONDS = 45;

function roundTo500(value) {
  if (typeof value !== "number") return 0;
  return Math.round(value / 500) * 500;
}

function getPriceRangeMultiplier(district, product) {
  if (!district || !product) return 0.75 + Math.random() * 0.5;
  const base = district.basePrices && district.basePrices[product]
    ? district.basePrices[product]
    : 10000;
  // random price within 75%-125% base
  let min = 0.75;
  let max = 1.25;
  if (district.specialty === product) {
    max = 1.75;
    min = 0.85;
  }
  if (district.weakness === product) {
    min = 0.5;
    max = 1.0;
  }
  return min + rand() * (max - min);
}

function generateDealingPrice(district, product) {
  const base = district.basePrices && district.basePrices[product]
    ? district.basePrices[product]
    : 10000;
  const multiplier = getPriceRangeMultiplier(district, product);
  return roundTo500(base * multiplier);
}

/**
 * Dispatch a gameStateChanged event so the client can re-render.
 * phaseChanged = true  → full re-render (phase transition or initial load)
 * phaseChanged = false → timer tick only; client should only update the countdown
 */
function emit(phase, phaseChanged = false) {
  window.dispatchEvent(
    new CustomEvent("gameStateChanged", { detail: { phase, phaseChanged } }),
  );
}

export function startPhaseTimer() {
  if (intervalId) return; // already running

  // If starting in Dealing phase, generate dealing prices and run production once
  if (gameState.phase === "Dealing") {
    gameState.districts.forEach((d) => {
      d.dealingPrices = {};
      ["coke", "weed", "heroin"].forEach((pt) => {
        const price = generateDealingPrice(d, pt);
        d.dealingPrices[pt] = roundTo500(price);
      });
    });
    runProduction();
  }

  // Initial render — treat as a phase change so the full UI is drawn
  emit(gameState.phase, true);

  intervalId = setInterval(() => {
    if (typeof gameState.timer !== "number")
      gameState.timer = DEFAULT_PHASE_SECONDS;

    if (gameState.timer > 0) {
      gameState.timer -= 1;
      emit(gameState.phase, false); // timer tick only
      return;
    }

    // Timer reached 0 — advance phase
    phaseIndex = (phaseIndex + 1) % PHASES.length;
    gameState.phase = PHASES[phaseIndex];
    gameState.timer = DEFAULT_PHASE_SECONDS;

    // Increment roundNumber when cycle returns to Buying
    if (gameState.phase === "Buying") {
      gameState.roundNumber = (gameState.roundNumber || 0) + 1;
    }

    // Process raid timers only (decay happens each Buying phase start)
    processRaidTimers();

    // ── Buying phase entry ───────────────────────────────────────────────────
    if (gameState.phase === "Buying") {
      // Decay heat once per Buying stage (slower overall heat drop)
      decayHeat();

      // Passive raids at start of Buying
      const passiveRaided = runPassiveRaids();
      if (Array.isArray(passiveRaided) && passiveRaided.length) {
        passiveRaided.forEach((id) => {
          const d = gameState.districts.find((x) => x.id === id);
          if (!d) return;
          addNews(`Passive RAID: ${d.id} (${d.name}) was raided.`);
        });
      }

      // Resolve queued attacks from the previous Attacking phase
      if (Array.isArray(gameState.queuedAttacks) && gameState.queuedAttacks.length > 0) {
        gameState.queuedAttacks.forEach((a) => {
          const src = gameState.districts.find((x) => x.id === a.fromId);
          const tgt = gameState.districts.find((x) => x.id === a.toId);
          if (!src || !tgt) return;

          // Clamp committed thugs to what is actually available at resolution time
          const committed = Math.min(a.thugsCount || 0, src.thugs || 0);
          if (committed <= 0) return;

          src.thugs = Math.max(0, (src.thugs || 0) - committed);
          const res = resolveAttack(src, committed, tgt);

          const attackerId = src.owner;
          const attacker = getPlayer(attackerId);
          const defender = getPlayer(tgt.owner);

          if (res.attackerWon) {
            tgt.thugs = Math.max(0, (tgt.thugs || 0) - (res.defenderLosses || 0));
            tgt.owner = attackerId;
            const survivors = res.attackerSurvivors || Math.max(0, committed - (res.attackerLosses || 0));
            tgt.thugs = (tgt.thugs || 0) + survivors;
            tgt.pendingAttack = false;
            addNews(`${attackerId} captured ${tgt.id} (${tgt.name}). Attacker lost ${res.attackerLosses || 0}, Defender lost ${res.defenderLosses || 0}.`);
          } else {
            tgt.thugs = Math.max(0, (tgt.thugs || 0) - (res.defenderLosses || 0));
            tgt.pendingAttack = false;
            addNews(`${attackerId} was repelled at ${tgt.id} (${tgt.name}). Attacker lost ${res.attackerLosses || 0}, Defender lost ${res.defenderLosses || 0}.`);
          }

          // emit an immediate state change so UI refreshes pendingAttack highlights
          emit(gameState.phase, true);

          // Check for victory after each ownership change
          const victor = checkVictory();
          if (victor) {
            window.dispatchEvent(new CustomEvent('gameOver', { detail: { winner: victor } }));
          }
        });

        // Clear the attack queue
        gameState.queuedAttacks = [];
        // Ensure no stale pendingAttack highlights remain
        gameState.districts.forEach((d) => {
          if (d.pendingAttack) d.pendingAttack = false;
        });
        emit(gameState.phase, true);
      }

      // Reset round-scoped modifiers and active card effect indicators
      gameState.eventModifiers = {};
      gameState.activeCardEffects = [];

      // Draw one card for each player and a new event tile at the start of each round (Buying = round start)
      gameState.players.forEach((p) => drawCard(p.id));
      drawEventTile();
      applyEventEffect();

      // Reset per-player round counters
      gameState.players.forEach((p) => {
        p.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
        p.soldThisRound = 0;
        p.thugsHiredThisRound = 0;
        p.hasAttackedThisRound = false;
        // reset played-card flag so hand UI returns to normal
        p.playedCardThisRound = false;
      });

      // Let bot players run their Buying-phase decisions with a small randomized delay
      gameState.players.forEach((p) => {
        if (p.isBot) {
          const delay = Math.floor(300 + rand() * 1200);
          setTimeout(() => AI.onBuyingPhase(p.id), delay);
        }
      });

      // Check elimination — emit gameOver if a player has been removed
      const removed = checkElimination();
      if (removed && removed.length) {
        const humanExists = gameState.players && gameState.players.length > 0;
        window.dispatchEvent(
          new CustomEvent("gameOver", { detail: { humanExists } }),
        );
      }
    }

    // ── Dealing phase entry ───────────────────────────────────────────────────
    if (gameState.phase === "Dealing") {
      const priceMultiplier =
        (gameState.eventModifiers &&
          gameState.eventModifiers.priceMultiplier) ||
        1;
      gameState.districts.forEach((d) => {
        d.dealingPrices = {};
        ["coke", "weed", "heroin"].forEach((pt) => {
          const price = generateDealingPrice(d, pt) * priceMultiplier;
          d.dealingPrices[pt] = roundTo500(price);
        });
      });
      runProduction();

      // Let bot players run their Dealing-phase decisions with slight delays
      gameState.players.forEach((p) => {
        if (p.isBot) {
          const delay = Math.floor(200 + rand() * 1000);
          setTimeout(() => AI.onDealingPhase(p.id), delay);
        }
      });
    }

    // Run bot attacks when entering Attacking phase
    if (gameState.phase === "Attacking") {
      gameState.players.forEach((p) => {
        if (p.isBot) {
          const delay = Math.floor(500 + rand() * 2000);
          setTimeout(() => AI.onAttackingPhase(p.id), delay);
        }
      });
    }

    // Initial render — treat as a phase change so the full UI is drawn
    emit(gameState.phase, true);
  }, 1000);
}

export function stopPhaseTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
