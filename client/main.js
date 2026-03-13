// client/main.js
import { renderSidebar, renderPhaseBanner, renderTimer } from './ui.js';
import { renderBoard } from './board.js';
import { gameState, initGameState } from '../game/state.js';
import { startPhaseTimer } from '../game/phases.js';
import { initInput } from './input.js';

document.addEventListener('DOMContentLoaded', async () => {
  // initialize game state (loads districts.json)
  await initGameState();

  renderSidebar();
  // render from gameState
  renderPhaseBanner(gameState.phase);
  renderTimer(gameState.timer);

  renderBoard(gameState.districts);

  // start the phase timer which updates gameState and UI
  startPhaseTimer();

  // wire input handlers
  initInput();
});
