// game/phases.js
// Manages phase transitions and the phase timer. Calls UI renderers on changes.

import { gameState } from './state.js';
import { renderPhaseBanner, renderTimer, renderSidebar } from '../client/ui.js';
import { runProduction } from './economy.js';
import { updateDistrict } from '../client/board.js';

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
  // if starting in Buying phase, run production once
  if(gameState.phase === 'Buying'){
    const changed = runProduction();
    changed.forEach(id => {
      const d = gameState.districts.find(x => x.id === id);
      if(d) updateDistrict(id, d);
    });
    renderSidebar();
  }

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
    // if we've just entered Buying, run production
    if(gameState.phase === 'Buying'){
      const changed = runProduction();
      changed.forEach(id => {
        const d = gameState.districts.find(x => x.id === id);
        if(d) updateDistrict(id, d);
      });
      renderSidebar();
    }
  }, 1000);
}

export function stopPhaseTimer(){
  if(intervalId){
    clearInterval(intervalId);
    intervalId = null;
  }
}
