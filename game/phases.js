// game/phases.js
// Manages phase transitions and the phase timer. Calls UI renderers on changes.

import { gameState, checkElimination } from './state.js';
import { renderPhaseBanner, renderTimer, renderSidebar, showGameOver, clearActionPanel } from '../client/ui.js';
import { runProduction } from './economy.js';
import { updateDistrict } from '../client/board.js';
import { decayHeat, checkRaids, processRaidTimers } from './heat.js';
import { resolveAttack } from './combat.js';

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

    // Announce raids as news items so the news panel shows them
    if(Array.isArray(newlyRaided) && newlyRaided.length){
      if(!gameState.news) gameState.news = [];
      newlyRaided.forEach(id => {
        const d = gameState.districts.find(x => x.id === id);
        if(!d) return;
        const msg = `RAID: ${d.id} (${d.name}) was raided — one building lost.`;
        gameState.news.push({ text: msg, ts: Date.now() });
      });
      // update sidebar so news panel appears
      renderSidebar();
    }

  // notify UI
  renderPhaseBanner(gameState.phase);
  renderTimer(gameState.timer);
  // clear action panel when leaving Dealing (sell period is over)
  if(gameState.phase !== 'Dealing') clearActionPanel();
    // phase-enter actions
  if(gameState.phase === 'Buying'){
      // process queued attacks from previous Attacking phase
      if(Array.isArray(gameState.queuedAttacks) && gameState.queuedAttacks.length > 0){
        gameState.queuedAttacks.forEach(a => {
          const src = gameState.districts.find(x => x.id === a.fromId);
          const tgt = gameState.districts.find(x => x.id === a.toId);
          if(!src || !tgt) return;
          // clamp committed to what's actually available at the time of resolution
          const committed = Math.min(a.thugsCount || 0, src.thugs || 0);
          if(committed <= 0) return;
          // remove committed thugs from source immediately
          src.thugs = Math.max(0, (src.thugs || 0) - committed);
          const res = resolveAttack(src, committed, tgt);
          // if attacker won
            if(res.attackerWon){
            // apply defender losses (for completeness)
            tgt.thugs = Math.max(0, (tgt.thugs || 0) - (res.defenderLosses || 0));
            // transfer ownership
            tgt.owner = 'owned';
            // set defender thugs to survivors (attacker survivors occupy)
            const survivors = res.attackerSurvivors || Math.max(0, committed - (res.attackerLosses || 0));
            tgt.thugs = (tgt.thugs || 0) + survivors;
            // news
            if(!gameState.news) gameState.news = [];
            const winnerLosses = res.attackerLosses || 0;
            const msg = `You captured ${tgt.id} (${tgt.name}). You lost ${winnerLosses} thugs.`;
            gameState.news.push({ text: msg, ts: Date.now() });
          } else {
            // attacker lost: they were already removed from source by committed subtraction
            // defender takes losses
            tgt.thugs = Math.max(0, (tgt.thugs || 0) - (res.defenderLosses || 0));
            if(!gameState.news) gameState.news = [];
            const defenderLosses = res.defenderLosses || 0;
            const msg = `You were repelled at ${tgt.id} (${tgt.name}). Defender lost ${defenderLosses} thugs.`;
            gameState.news.push({ text: msg, ts: Date.now() });
          }
          // update visuals
          updateDistrict(src.id, src);
          updateDistrict(tgt.id, tgt);
        });
  // clear queue
  gameState.queuedAttacks = [];
        // clear any highlights on the board
        try{ const board = document.querySelector && document.getElementById('board'); if(board){ const els = board.querySelectorAll('.highlight'); els.forEach(e=>e.classList.remove('highlight')); } }catch(e){}
      }

      // reset per-player buildings bought counters and round-based counters
      gameState.players.forEach(p => {
        p.buildingsBoughtThisRound = { lab:0, growhouse:0, refinery:0 };
        // reset sales/pusher usage for the new round
        p.soldThisRound = 0;
        // reset thugs hired counter
        p.thugsHiredThisRound = 0;
        // reset attack-used flag for the new round
        p.hasAttackedThisRound = false;
      });
      renderSidebar();
      // check elimination (simple check for owned districts)
      const removed = checkElimination();
      if(removed && removed.length){
        // if player removed, game over
        // determine if human (player1) still exists
        const humanExists = gameState.players && gameState.players.length > 0;
        showGameOver(humanExists);
      }
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
