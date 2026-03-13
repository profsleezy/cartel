// game/heat.js
// Probabilistic raid system. Heat is capped and increases raid chance.

import { gameState } from './state.js';

const HEAT_CAP = 20;

/** Add heat to a district, clamp to HEAT_CAP, return new heat value */
export function addHeat(districtId, amount = 1){
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return null;
  if(typeof d.heat !== 'number') d.heat = 0;
  d.heat = Math.min(HEAT_CAP, d.heat + amount);
  return d.heat;
}

/** Reduce heat for all districts by 1 (not below 0). Returns changed ids. */
export function decayHeat(){
  const changed = [];
  gameState.districts.forEach(d => {
    if(typeof d.heat !== 'number') d.heat = 0;
    if(d.heat > 0){
      d.heat = Math.max(0, d.heat - 1);
      changed.push(d.id);
    }
  });
  return changed;
}

/**
 * rollRaid calculates probabilistic raid occurrence for a district.
 * Formula: chance = district.heat * 0.05
 * Returns true if a raid should occur.
 */
export function rollRaid(districtId){
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return false;
  const heat = typeof d.heat === 'number' ? d.heat : 0;
  // reduce raid frequency: scale heat to a max 25% chance at HEAT_CAP
  const chance = (heat / HEAT_CAP) * 0.25; // linear scale 0..0.25
  return Math.random() < chance;
}

/** Trigger a raid: set raided=true and raidTimer=2 */
export function triggerRaid(districtId){
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return false;
  d.raided = true;
  d.raidTimer = 2;
  return true;
}

/** Decrement raid timers and clear raided when timer hits 0. Returns changed ids. */
export function tickRaidTimers(){
  const changed = [];
  gameState.districts.forEach(d => {
    if(d.raided && typeof d.raidTimer === 'number'){
      d.raidTimer = Math.max(0, d.raidTimer - 1);
      if(d.raidTimer === 0){
        d.raided = false;
        delete d.raidTimer;
      }
      changed.push(d.id);
    }
  });
  return changed;
}

export { HEAT_CAP };

// Back-compat wrappers (phases.js expects these names)
export function checkRaids(){
  const newly = [];
  gameState.districts.forEach(d => {
    // probabilistic check per-district
    if(rollRaid(d.id)){
      triggerRaid(d.id);
      newly.push(d.id);
    }
  });
  return newly;
}

export function processRaidTimers(){
  return tickRaidTimers();
}
