// game/economy.js
// Economic actions: production and buying infrastructure (labs)

import { gameState } from './state.js';

const STORAGE_CAP = 5; // max product a district can store
const LAB_COST = 200; // cost to buy a lab

/**
 * Add one product to the district up to STORAGE_CAP.
 * Returns true if product was added, false if already full or not producing.
 */
export function produceProduct(districtId){
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return false;
  // only owned districts with labs produce
  if(d.owner !== 'owned' || !d.labs) return false;
  if(typeof d.product !== 'number') d.product = 0;
  if(d.product >= STORAGE_CAP) return false;
  d.product += 1;
  return true;
}

/**
 * Run production over all districts. Returns array of district ids that changed.
 */
export function runProduction(){
  const changed = [];
  gameState.districts.forEach(d => {
    const before = d.product || 0;
    const added = produceProduct(d.id);
    if(added) changed.push(d.id);
  });
  return changed;
}

/**
 * Attempt to buy a lab on behalf of the first player.
 * Deducts cash and sets d.labs = true. Returns { success, message, district }.
 */
export function buyLab(districtId){
  const player = gameState.players[0];
  if(!player) return { success:false, message:'No player' };
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return { success:false, message:'District not found' };
  if(d.owner !== 'owned') return { success:false, message:'Cannot buy lab on non-owned district' };
  if(d.labs) return { success:false, message:'Already has lab' };
  if(player.cash < LAB_COST) return { success:false, message:'Insufficient cash' };

  player.cash -= LAB_COST;
  d.labs = true;

  return { success:true, message:'Lab purchased', district: d };
}
