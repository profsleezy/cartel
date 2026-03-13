// game/phases.js
// Manages phase transitions and the phase timer. Calls UI renderers on changes.

import { gameState } from './state.js';
import { renderPhaseBanner, renderTimer, renderSidebar } from '../client/ui.js';
import { runProduction } from './economy.js';
import { updateDistrict } from '../client/board.js';
import { decayHeat, checkRaids, processRaidTimers } from './heat.js';

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
  // if starting in Dealing phase, generate dealing prices and run production once
  if(gameState.phase === 'Dealing'){
    // generate random dealing prices per district
    gameState.districts.forEach(d => {
      d.dealingPrices = {};
      ['coke','weed','heroin'].forEach(pt => {
        const base = (d.prices && d.prices[pt]) ? d.prices[pt] : 100;
        d.dealingPrices[pt] = base * (0.75 + Math.random() * 0.5);
      });
    });
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

  // Start of a new round: process raid timers, decay heat, and check for new raids
    const raidTimerChanged = processRaidTimers();
    raidTimerChanged.forEach(id => {
      const d = gameState.districts.find(x => x.id === id);
      if(d) updateDistrict(id, d);
    });

    const decayed = decayHeat();
    decayed.forEach(id => {
      const d = gameState.districts.find(x => x.id === id);
      if(d) updateDistrict(id, d);
    });

    const newlyRaided = checkRaids();
    newlyRaided.forEach(id => {
      const d = gameState.districts.find(x => x.id === id);
      if(d) updateDistrict(id, d);
    });

    // notify UI
    renderPhaseBanner(gameState.phase);
    renderTimer(gameState.timer);
    // phase-enter actions
    if(gameState.phase === 'Buying'){
      // reset per-player buildings bought counters
      gameState.players.forEach(p => {
        p.buildingsBoughtThisRound = { lab:0, growhouse:0, refinery:0 };
        // reset sales/pusher usage for the new round
        p.soldThisRound = 0;
      });
      renderSidebar();
    }

    if(gameState.phase === 'Dealing'){
      // generate random dealing prices per district
      gameState.districts.forEach(d => {
        d.dealingPrices = {};
        ['coke','weed','heroin'].forEach(pt => {
          const base = (d.prices && d.prices[pt]) ? d.prices[pt] : 100;
          d.dealingPrices[pt] = base * (0.75 + Math.random() * 0.5);
        });
      });
      // run production at start of Dealing
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
