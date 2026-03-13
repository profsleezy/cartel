// game/economy.js
// Economic actions: production and buying infrastructure (labs)

import { gameState } from './state.js';
import { addHeat, rollRaid, triggerRaid } from './heat.js';

const STORAGE_CAP = 5; // max product units per type a district can store
// Building cost ladder (per-player escalation). Max 3 purchases per type per round.
const BUILDING_COSTS = [100, 180, 300];

/**
 * Add one product to the district up to STORAGE_CAP.
 * Returns true if product was added, false if already full or not producing.
 */
export function produceProduct(districtId){
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return false;
  if(d.owner !== 'owned') return false;
  // produce 1 unit per building of corresponding type, but deposit into player.inventory
  // building type -> product type mapping
  const mapping = { lab: 'coke', growhouse: 'weed', refinery: 'heroin' };
  let changed = false;
  const player = gameState.players && gameState.players[0];
  if(!player) return false;
  if(!player.inventory) player.inventory = { coke:0, weed:0, heroin:0 };
  if(Array.isArray(d.buildings)){
    d.buildings.forEach(b => {
      const ptype = mapping[b.type];
      if(!ptype) return;
      // add a random 1-3 units to player inventory per building
      const amount = Math.floor(Math.random() * 3) + 1; // 1..3
      player.inventory[ptype] = (player.inventory[ptype] || 0) + amount;
      changed = true;
    });
  }
  return changed;
}

/**
 * Run production over all districts. Returns array of district ids that changed.
 */
export function runProduction(){
  const changed = [];
  gameState.districts.forEach(d => {
    const added = produceProduct(d.id);
    if(added) changed.push(d.id);
  });
  return changed;
}

/**
 * Attempt to buy a lab on behalf of the first player.
 * Deducts cash and sets d.labs = true. Returns { success, message, district }.
 */
export function buyBuilding(districtId, type){
  const player = gameState.players[0];
  if(!player) return { success:false, message:'No player' };
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return { success:false, message:'District not found' };
  if(d.owner !== 'owned') return { success:false, message:'Cannot buy building on non-owned district' };
  if(!Array.isArray(d.buildings)) d.buildings = [];
  if(d.buildings.length >= 5) return { success:false, message:'District has max buildings' };
  // determine cost based on player's per-round purchases
  if(!player.buildingsBoughtThisRound) player.buildingsBoughtThisRound = { lab:0, growhouse:0, refinery:0 };
  const alreadyBought = player.buildingsBoughtThisRound[type] || 0;
  // enforce max 3 purchases of the same type per round
  if(alreadyBought >= 3) return { success:false, message:'Reached per-round purchase limit for this building type' };
  const idx = Math.min(alreadyBought, BUILDING_COSTS.length - 1);
  // cost rounded to nearest 5 per rules
  const cost = Math.round(BUILDING_COSTS[idx] / 5) * 5;
  if(player.cash < cost) return { success:false, message:'Insufficient cash', cost };

  player.cash -= cost;
  player.buildingsBoughtThisRound[type] = alreadyBought + 1;
  d.buildings.push({ type });

  return { success:true, message:'Building purchased', district: d, cost };
}

/**
 * Buy a pusher for the player. Cost assumed $50 (rounded to nearest 5).
 */
export function buyPusher(){
  const player = gameState.players[0];
  if(!player) return { success:false, message:'No player' };
  const cost = Math.round(50 / 5) * 5;
  if(player.cash < cost) return { success:false, message:'Insufficient cash', cost };
  player.cash -= cost;
  player.pushers = (player.pushers || 0) + 1;
  // round cash per rules
  player.cash = Math.round(player.cash / 5) * 5;
  return { success:true, message:'Bought pusher', pushers: player.pushers, cost };
}

/**
 * Remove a building from a district by index and refund half the base cost (50).
 * Returns { success, message, district, refund }
 */
export function deleteBuilding(districtId, buildingIndex){
  const player = gameState.players[0];
  if(!player) return { success:false, message:'No player' };
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return { success:false, message:'District not found' };
  if(d.owner !== 'owned') return { success:false, message:'Cannot delete building on non-owned district' };
  if(!Array.isArray(d.buildings)) d.buildings = [];
  if(buildingIndex < 0 || buildingIndex >= d.buildings.length) return { success:false, message:'Invalid building index' };

  // remove building
  const removed = d.buildings.splice(buildingIndex, 1);
  // refund half of base cost 100 => 50 (rounded to nearest 5)
  const refund = Math.round(50 / 5) * 5;
  player.cash += refund;

  return { success:true, message:'Building removed', district: d, refund };
}

/**
 * Sell one unit of product of the given type from the district.
 * Adds cash to the first player according to district prices and increases heat.
 * Returns { success, message, district, amount }
 */
// Simplified dealing: sells from player.inventory at the given district's dealingPrices
export function dealProduct(districtId, productType = 'coke'){
  const player = gameState.players[0];
  if(!player) return { success:false, message:'No player' };
  const d = gameState.districts.find(x => x.id === districtId);
  if(!d) return { success:false, message:'District not found' };
  if(d.owner !== 'owned') return { success:false, message:'District must be owned to sell here' };
  if(d.raided) return { success:false, message:'District is raided' };
  if(!player.inventory || (player.inventory[productType] || 0) <= 0) return { success:false, message:'No product in player inventory' };

  // enforce pusher-based selling limit: each pusher allows selling 2 products per round
  const pushers = player.pushers || 0;
  const maxSells = pushers * 2;
  if(typeof player.soldThisRound !== 'number') player.soldThisRound = 0;
  if(player.soldThisRound >= maxSells) return { success:false, message:'No available pushers capacity to sell this round' };

  // determine price from district's dealingPrices (may have been generated by phases). Round to nearest 5.
  let priceUnrounded = (d.dealingPrices && d.dealingPrices[productType]) ? d.dealingPrices[productType] : ((d.prices && d.prices[productType]) ? d.prices[productType] : 100);
  const price = Math.round(priceUnrounded / 5) * 5;

  // remove one unit from player inventory
  player.inventory[productType] = (player.inventory[productType] || 0) - 1;
  // record sale
  player.soldThisRound = (player.soldThisRound || 0) + 1;
  // add rounded cash
  player.cash += price;
  // ensure cash rounded to nearest 5 (keep whole dollars but comply with rule)
  player.cash = Math.round(player.cash / 5) * 5;

  // increase heat at the district where dealing occurs
  addHeat(districtId, 2);

  // probabilistic raid check at district
  const raidedNow = rollRaid(districtId);
  if(raidedNow){
    triggerRaid(districtId);
    return { success:true, message:'Sold product', district: d, amount: price, raided: true };
  }

  return { success:true, message:'Sold product', district: d, amount: price, raided: false };
}
