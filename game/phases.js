// game/phases.js
// Manages phase transitions and the phase timer.
// All rendering is decoupled: game logic emits 'gameStateChanged' and 'gameOver'
// custom events; client/main.js listens and drives the UI.

import { gameState, checkElimination, getPlayer } from "./state.js";
import { runProduction } from "./economy.js";
import { decayHeat, runPassiveRaids, processRaidTimers } from "./heat.js";
import { resolveAttack } from "./combat.js";
import { drawEventTile, applyEventEffect } from "./events.js";
import { drawCard } from "./cards.js";

const PHASES = ["Buying", "Dealing", "Attacking"];
let intervalId = null;
let phaseIndex = PHASES.indexOf(gameState.phase);
if (phaseIndex === -1) phaseIndex = 0;

const DEFAULT_PHASE_SECONDS = 45;

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
        const base = d.prices && d.prices[pt] ? d.prices[pt] : 100;
        d.dealingPrices[pt] = base * (0.75 + Math.random() * 0.5);
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
        if (!gameState.news) gameState.news = [];
        passiveRaided.forEach((id) => {
          const d = gameState.districts.find((x) => x.id === id);
          if (!d) return;
          gameState.news.push({
            text: `Passive RAID: ${d.id} (${d.name}) was raided.`,
            ts: Date.now(),
          });
        });
      }

      // Resolve queued attacks from the previous Attacking phase
      if (
        Array.isArray(gameState.queuedAttacks) &&
        gameState.queuedAttacks.length > 0
      ) {
        gameState.queuedAttacks.forEach((a) => {
          const src = gameState.districts.find((x) => x.id === a.fromId);
          const tgt = gameState.districts.find((x) => x.id === a.toId);
          if (!src || !tgt) return;

          // Clamp committed thugs to what is actually available at resolution time
          const committed = Math.min(a.thugsCount || 0, src.thugs || 0);
          if (committed <= 0) return;

          src.thugs = Math.max(0, (src.thugs || 0) - committed);
          const res = resolveAttack(src, committed, tgt);

          if (res.attackerWon) {
            tgt.thugs = Math.max(
              0,
              (tgt.thugs || 0) - (res.defenderLosses || 0),
            );
            tgt.owner = "player1";
            const survivors =
              res.attackerSurvivors ||
              Math.max(0, committed - (res.attackerLosses || 0));
            tgt.thugs = (tgt.thugs || 0) + survivors;
            tgt.pendingAttack = false;
            if (!gameState.news) gameState.news = [];
            gameState.news.push({
              text: `You captured ${tgt.id} (${tgt.name}). You lost ${res.attackerLosses || 0} thugs.`,
              ts: Date.now(),
            });
          } else {
            tgt.thugs = Math.max(
              0,
              (tgt.thugs || 0) - (res.defenderLosses || 0),
            );
            tgt.pendingAttack = false;
            if (!gameState.news) gameState.news = [];
            gameState.news.push({
              text: `You were repelled at ${tgt.id} (${tgt.name}). Defender lost ${res.defenderLosses || 0} thugs.`,
              ts: Date.now(),
            });
          }
        });

        // Clear the attack queue
        gameState.queuedAttacks = [];
      }

      // Reset round-scoped modifiers and active card effect indicators
      gameState.eventModifiers = {};
      gameState.activeCardEffects = [];

      // Draw one card and a new event tile at the start of each round (Buying = round start)
      drawCard();
      drawEventTile();
      applyEventEffect();

      // Reset per-player round counters
      gameState.players.forEach((p) => {
        p.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
        p.soldThisRound = 0;
        p.thugsHiredThisRound = 0;
        p.hasAttackedThisRound = false;
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
          const base = d.prices && d.prices[pt] ? d.prices[pt] : 100;
          d.dealingPrices[pt] =
            base * (0.75 + Math.random() * 0.5) * priceMultiplier;
        });
      });
      runProduction();
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
