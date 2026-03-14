// client/main.js
import {
  renderSidebar,
  renderGameStatus,
  renderEventTile,
  clearActionPanel,
  showGameOver,
} from "./ui.js";
import { renderBoard, updateDistrict, highlightTargets } from "./board.js";
import { gameState, initGameState } from "../game/state.js";
import { startPhaseTimer } from "../game/phases.js";
import { initEvents } from "../game/events.js";
import { initCards, dealStartingHand } from "../game/cards.js";
import { initInput } from "./input.js";

// Re-render UI whenever game state changes.
// phaseChanged = true  → full re-render (phase transition or initial load)
// phaseChanged = false → timer tick; only the countdown needs updating
window.addEventListener("gameStateChanged", (e) => {
  renderGameStatus();
  renderEventTile();
  if (e.detail.phaseChanged) {
    renderSidebar();
    clearActionPanel();
    highlightTargets([]);
    gameState.districts.forEach((d) => updateDistrict(d.id, d));
  }
});

// Show game-over overlay when phases.js detects elimination.
window.addEventListener("gameOver", (e) => {
  showGameOver(e.detail.humanExists);
});

document.addEventListener("DOMContentLoaded", async () => {
  // Load all data files in parallel before touching the DOM
  await Promise.all([initGameState(), initEvents(), initCards()]);

  // Deal the player's starting hand (needs card pool loaded first)
  dealStartingHand(2);

  // Initial render before the phase timer starts
  renderGameStatus();
  renderSidebar();
  renderBoard(gameState.districts);

  // Start the phase timer (fires gameStateChanged on every tick / phase change)
  startPhaseTimer();

  // Wire board and sidebar click handlers
  initInput();
});
