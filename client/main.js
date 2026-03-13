// client/main.js
import { renderSidebar, renderPhaseBanner, renderTimer } from './ui.js';
import { renderBoard } from './board.js';
import { gameState } from '../game/state.js';
import { startPhaseTimer } from '../game/phases.js';

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  // render from gameState
  renderPhaseBanner(gameState.phase);
  renderTimer(gameState.timer);

  renderBoard(gameState.districts);

  // start the phase timer which updates gameState and UI
  startPhaseTimer();
});
