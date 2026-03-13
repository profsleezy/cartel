// game/phases.js
// Manages phase transitions and the phase timer. Calls UI renderers on changes.

import { gameState } from './state.js';
import { renderPhaseBanner, renderTimer } from '../client/ui.js';

const PHASES = ['Buying', 'Dealing', 'Attacking'];
let intervalId = null;
let phaseIndex = PHASES.indexOf(gameState.phase);
if (phaseIndex === -1) phaseIndex = 0;

const DEFAULT_PHASE_SECONDS = 45;

export function startPhaseTimer(){
  if(intervalId) return; // already running

  // initial render
  renderPhaseBanner(gameState.phase);
  renderTimer(gameState.timer);

  intervalId = setInterval(() => {
    if (typeof gameState.timer !== 'number') gameState.timer = DEFAULT_PHASE_SECONDS;

    if (gameState.timer > 0) {
      gameState.timer -= 1;
      renderTimer(gameState.timer);
      return;
    }

    // time reached 0 -> advance phase
    phaseIndex = (phaseIndex + 1) % PHASES.length;
    gameState.phase = PHASES[phaseIndex];
    // reset timer
    gameState.timer = DEFAULT_PHASE_SECONDS;
    // increment roundNumber on each phase change as requested
    gameState.roundNumber = (gameState.roundNumber || 0) + 1;

    // notify UI
    renderPhaseBanner(gameState.phase);
    renderTimer(gameState.timer);
  }, 1000);
}

export function stopPhaseTimer(){
  if(intervalId){
    clearInterval(intervalId);
    intervalId = null;
  }
}
