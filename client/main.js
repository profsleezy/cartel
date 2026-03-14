// client/main.js
import {
  renderSidebar,
  renderPhaseBanner,
  renderTimer,
  clearActionPanel,
  showGameOver,
} from "./ui.js";
import { renderBoard, updateDistrict, highlightTargets } from "./board.js";
import { gameState, initGameState } from "../game/state.js";
import { startPhaseTimer } from "../game/phases.js";
import { initInput } from "./input.js";

// Re-render UI whenever game state changes.
// phaseChanged = true  → full re-render (phase transition or initial load)
// phaseChanged = false → timer tick; only the countdown needs updating
window.addEventListener("gameStateChanged", (e) => {
  renderTimer(gameState.timer);
  if (e.detail.phaseChanged) {
    renderPhaseBanner(gameState.phase);
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
  // Load districts.json and build initial gameState
  await initGameState();

  // Initial render before the phase timer starts
  renderPhaseBanner(gameState.phase);
  renderTimer(gameState.timer);
  renderSidebar();
  renderBoard(gameState.districts);

  // Start the phase timer (fires gameStateChanged on every tick / phase change)
  startPhaseTimer();

  // Wire board click handlers
  initInput();
});
