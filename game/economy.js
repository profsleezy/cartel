// game/economy.js
// Economic actions: production and buying infrastructure

import { gameState, getPlayer } from "./state.js";
import { addHeat, rollRaid, triggerRaid } from "./heat.js";
import { rand } from "./rng.js";

// Building cost ladder (per-player escalation). Max 3 purchases per type per round.
const BUILDING_COSTS = [10000, 18000, 30000];

/**
 * Run production on a district: deposit units into district.stash for each building.
 * Random 1–3 units per building. Returns true if any product was added.
 */
export function produceProduct(districtId) {
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d) return false;
  if (!d.owner || d.owner === "neutral") return false;
  // Raided districts cannot produce until recovered.
  if (d.raided) return false;
  const mapping = { lab: "coke", growhouse: "weed", refinery: "heroin" };
  let changed = false;
  if (!d.stash) d.stash = { coke: 0, weed: 0, heroin: 0 };
  if (Array.isArray(d.buildings)) {
    d.buildings.forEach((b) => {
      const ptype = mapping[b.type];
      if (!ptype) return;
      // 1..3 units into the district's own stash, scaled by any active production modifier
      const multiplier =
        (gameState.eventModifiers &&
          gameState.eventModifiers.productionMultiplier) ||
        1;
      const amount = Math.ceil((Math.floor(rand() * 3) + 1) * multiplier);
      d.stash[ptype] = (d.stash[ptype] || 0) + amount;
      changed = true;
    });
  }
  return changed;
}

/**
 * Run production over all districts. Returns array of district ids that changed.
 */
export function runProduction() {
  const changed = [];
  gameState.districts.forEach((d) => {
    const added = produceProduct(d.id);
    if (added) changed.push(d.id);
  });
  return changed;
}

/**
 * Attempt to buy a building on behalf of player1.
 * Returns { success, message, district, cost }.
 */
export function buyBuilding(districtId, type, playerId = "player1") {
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: "No player" };
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d) return { success: false, message: "District not found" };
  if (d.owner !== playerId)
    return {
      success: false,
      message: "Cannot buy building on non-owned district",
    };
  if (!Array.isArray(d.buildings)) d.buildings = [];
  if (d.buildings.length >= 5)
    return { success: false, message: "District has max buildings" };
  if (!player.buildingsBoughtThisRound)
    player.buildingsBoughtThisRound = { lab: 0, growhouse: 0, refinery: 0 };
  const alreadyBought = player.buildingsBoughtThisRound[type] || 0;
  if (alreadyBought >= 3)
    return {
      success: false,
      message: "Reached per-round purchase limit for this building type",
    };
  const idx = Math.min(alreadyBought, BUILDING_COSTS.length - 1);
  const cost = Math.round(BUILDING_COSTS[idx] / 5) * 5;
  if (player.cash < cost)
    return { success: false, message: "Insufficient cash", cost };
  player.cash -= cost;
  player.buildingsBoughtThisRound[type] = alreadyBought + 1;
  d.buildings.push({ type });
  return { success: true, message: "Building purchased", district: d, cost };
}

/**
 * Hire thug(s) on a district. Escalating cost per round.
 * Returns { success, message, district, cost, hired }.
 */
export function hireThugs(districtId, count = 1, playerId = "player1") {
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: "No player" };
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d) return { success: false, message: "District not found" };
  if (d.owner !== playerId)
    return { success: false, message: "Cannot hire on non-owned district" };
  if (!Array.isArray(d.buildings)) d.buildings = d.buildings || [];
  if (typeof d.thugs !== "number") d.thugs = 0;
  if (typeof player.thugsHiredThisRound !== "number")
    player.thugsHiredThisRound = 0;
  const allowed = Math.max(0, 3 - player.thugsHiredThisRound);
  if (allowed <= 0)
    return { success: false, message: "Reached per-round hire limit" };
  const toHire = Math.min(allowed, count);
  let totalCost = 0;
  for (let i = 0; i < toHire; i++) {
    const idx = Math.min(
      player.thugsHiredThisRound + i,
      BUILDING_COSTS.length - 1,
    );
    totalCost += BUILDING_COSTS[idx];
  }
  totalCost = Math.round(totalCost / 5) * 5;
  if (player.cash < totalCost)
    return { success: false, message: "Insufficient cash", cost: totalCost };
  player.cash -= totalCost;
  player.cash = Math.round(player.cash / 5) * 5;
  d.thugs = (d.thugs || 0) + toHire;
  player.thugsHiredThisRound = (player.thugsHiredThisRound || 0) + toHire;
  return {
    success: true,
    message: "Hired thugs",
    district: d,
    cost: totalCost,
    hired: toHire,
  };
}

/**
 * Buy a pusher for player1. Cost $150.
 * Returns { success, message, pushers, cost }.
 */
export function buyPusher(playerId = "player1") {
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: "No player" };
  const cost = Math.round(15000 / 5) * 5;
  if (player.cash < cost)
    return { success: false, message: "Insufficient cash", cost };
  player.cash -= cost;
  player.pushers = (player.pushers || 0) + 1;
  player.cash = Math.round(player.cash / 5) * 5;
  return {
    success: true,
    message: "Bought pusher",
    pushers: player.pushers,
    cost,
  };
}

/**
 * Remove a building from a district by index. Refunds $50.
 * Returns { success, message, district, refund }.
 */
export function deleteBuilding(districtId, buildingIndex, playerId = "player1") {
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: "No player" };
  const d = gameState.districts.find((x) => x.id === districtId);
  if (!d) return { success: false, message: "District not found" };
  if (d.owner !== playerId)
    return {
      success: false,
      message: "Cannot delete building on non-owned district",
    };
  if (!Array.isArray(d.buildings)) d.buildings = [];
  if (buildingIndex < 0 || buildingIndex >= d.buildings.length)
    return { success: false, message: "Invalid building index" };
  d.buildings.splice(buildingIndex, 1);
  const refund = Math.round(5000 / 5) * 5;
  player.cash += refund;
  return { success: true, message: "Building removed", district: d, refund };
}

/**
 * Sell product from a source district's stash at a target district.
 *
 * sourceDistrictId — district where product is stored
 * targetDistrictId — district where the sale occurs (sets price and takes heat)
 * productType      — 'coke' | 'weed' | 'heroin'
 * quantity         — units to sell (default 1)
 *
 * Pusher cap: player.pushers * 2 total units per round (tracked via soldThisRound).
 * Returns { success, message, sourceDistrict, targetDistrict, amount, raided }.
 */
export function dealProduct(
  sourceDistrictId,
  targetDistrictId,
  productType = "coke",
  quantity = 1,
  playerId = "player1",
) {
  const player = getPlayer(playerId);
  if (!player) return { success: false, message: "No player" };

  const src = gameState.districts.find((x) => x.id === sourceDistrictId);
  if (!src) return { success: false, message: "Source district not found" };
  if (!src.stash) src.stash = { coke: 0, weed: 0, heroin: 0 };
  if ((src.stash[productType] || 0) < quantity)
    return { success: false, message: "Insufficient product in source stash" };

  const tgt = gameState.districts.find((x) => x.id === targetDistrictId);
  if (!tgt) return { success: false, message: "Target district not found" };
  if (tgt.owner !== playerId)
    return {
      success: false,
      message: "Target district must be owned to sell here",
    };
  if (tgt.raided)
    return { success: false, message: "Target district is raided" };

  // pusher capacity check — pusher_double card/event can double the cap
  const capacityMultiplier =
    (gameState.eventModifiers &&
      gameState.eventModifiers.pusherCapacityMultiplier) ||
    1;
  const maxSells = (player.pushers || 0) * 2 * capacityMultiplier;
  if (typeof player.soldThisRound !== "number") player.soldThisRound = 0;
  if (player.soldThisRound + quantity > maxSells)
    return {
      success: false,
      message: "Exceeds pusher capacity for this round",
    };

  // price from target district's dealingPrices, rounded to nearest 5
  const rawPrice =
    tgt.dealingPrices && tgt.dealingPrices[productType]
      ? tgt.dealingPrices[productType]
      : tgt.prices && tgt.prices[productType]
        ? tgt.prices[productType]
        : 10000;
  const pricePerUnit = Math.round(rawPrice / 5) * 5;
  const totalAmount = pricePerUnit * quantity;

  // deduct from source stash
  src.stash[productType] -= quantity;

  // record sale and pay player
  player.soldThisRound += quantity;
  player.cash = Math.round((player.cash + totalAmount) / 5) * 5;

  // heat and raid on the target district (stack faster per sale)
  addHeat(targetDistrictId, quantity + 1);

  // raid_immunity (from a card or event) suppresses all raid rolls this round
  const immune =
    gameState.eventModifiers && gameState.eventModifiers.raidImmunity;
  // stash_protect lets the raid trigger on the district but preserves the stash
  const protected_ =
    gameState.eventModifiers && gameState.eventModifiers.stashProtect;

  const raidedNow = !immune && rollRaid(targetDistrictId);
  if (raidedNow) {
    if (protected_) {
      // Raid fires but stash survives — only remove thugs and a building
      const d = gameState.districts.find((x) => x.id === targetDistrictId);
      if (d) {
        d.raided = true;
        d.raidTimer = 2 * 3;
        d.thugs = 0;
        if (Array.isArray(d.buildings) && d.buildings.length > 0)
          d.buildings.pop();
        // stash deliberately NOT wiped
      }
    } else {
      triggerRaid(targetDistrictId);
    }
    return {
      success: true,
      message: "Sold product",
      sourceDistrict: src,
      targetDistrict: tgt,
      amount: totalAmount,
      raided: true,
    };
  }

  return {
    success: true,
    message: "Sold product",
    sourceDistrict: src,
    targetDistrict: tgt,
    amount: totalAmount,
    raided: false,
  };
}
